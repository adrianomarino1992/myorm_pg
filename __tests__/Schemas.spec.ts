import { TryAsync, CreateConnection } from "./functions/TestFunctions";
import Type from "../src/core/design/Type";
import PGDBManager from "../src/implementations/PGDBManager";
import Context from "./classes/TestContext";
import ErrorContext from "./classes/ErrorContext";
import { Person } from "./classes/TestEntity";
import EntityWithNoKey from "./classes/EntityWithNoKey";
import { ConstraintFailException } from "../src/Index";

describe("PostgreSQL database schema and metadata", () => {

    const createManager = () => {
        const connection = CreateConnection();
        const manager = new PGDBManager(connection);
        return { connection, manager };
    };

    test("should verify whether databases exist", async () => {

        const { manager } = createManager();

        const postgresExists = await manager.CheckDatabaseAsync("postgres");
        const mysqlExists = await manager.CheckDatabaseAsync("mysql");

        expect(postgresExists).toBeTruthy();
        expect(mysqlExists).toBeFalsy();

    });

    test(
        "should create a database when it does not exist",
        async () => {

            const { connection, manager } = createManager();

            let exists = await manager.CheckDatabaseAsync("test_db");

            if (exists) {
                await connection.AsPostgres().OpenAsync();
                await connection.ExecuteNonQueryAsync(
                    `select pg_terminate_backend(pid) 
                     from pg_stat_activity 
                     where datname = 'test_db';`
                );
                await connection.ExecuteNonQueryAsync(
                    "drop database test_db;"
                );
                await connection.CloseAsync();
            }

            await manager.CreateDataBaseAsync("test_db");

            exists = await manager.CheckDatabaseAsync("test_db");

            expect(exists).toBeTruthy();

        },
        100_000
    );

    describe("Tables (schemas)", () => {

        test(
            "should create a table and confirm it exists",
            async () => {

                const { connection, manager } = createManager();

                let exists = await manager.CheckTableAsync(Person);

                if (exists) {
                    await connection.OpenAsync();
                    await connection.ExecuteNonQueryAsync(
                        "drop table person_tb;"
                    );
                    await connection.CloseAsync();
                }

                await manager.CreateTableAsync(Person);

                exists = await manager.CheckTableAsync(Person);

                expect(exists).toBeTruthy();

            }
        );

        test(
            "should throw an error when creating a table without a primary key",
            async () => {

                const { manager } = createManager();
                const errorContext = new ErrorContext(manager);

                try {
                    await errorContext.UpdateDatabaseAsync();
                    fail("Expected table creation to fail");
                } catch (err) {
                    expect(err).toBeInstanceOf(ConstraintFailException);
                }

                const exists = await manager.CheckTableAsync(EntityWithNoKey);
                expect(exists).toBeFalsy();

            }
        );

        describe("Columns", () => {

            test(
                "should create a column and verify it exists",
                async () => {

                    const { connection, manager } = createManager();

                    let exists = await manager.CheckColumnAsync(Person, "Name");

                    if (exists) {
                        await connection.OpenAsync();
                        await connection.ExecuteNonQueryAsync(
                            "alter table person_tb drop column name;"
                        );
                        await connection.CloseAsync();
                    }

                    await manager.CreateColumnAsync(Person, "Name");

                    exists = await manager.CheckColumnAsync(Person, "Name");

                    expect(exists).toBeTruthy();

                }
            );

            test(
                "should create and then drop a column",
                async () => {

                    const { connection, manager } = createManager();

                    let exists = await manager.CheckColumnAsync(Person, "Name");

                    if (exists) {
                        await connection.OpenAsync();
                        await connection.ExecuteNonQueryAsync(
                            "alter table person_tb drop column name;"
                        );
                        await connection.CloseAsync();
                    }

                    await manager.CreateColumnAsync(Person, "Name");

                    expect(
                        await manager.CheckColumnAsync(Person, "Name")
                    ).toBeTruthy();

                    await manager.DropColumnAsync(Person, "Name");

                    expect(
                        await manager.CheckColumnAsync(Person, "Name")
                    ).toBeFalsy();

                }
            );

        });

        describe("Schema synchronization using context", () => {

            test(
                "should create all tables and columns defined in the context",
                async () => {

                    await TryAsync(
                        async () => {

                            const { connection, manager } = createManager();

                            manager.SetLogger((message) => {
                                console.log(message);
                            });

                            const context = new Context(manager);

                            for (const type of context.GetMappedTypes()) {
                                if (await manager.CheckTableAsync(type)) {
                                    await connection.OpenAsync();
                                    await connection.ExecuteNonQueryAsync(
                                        `drop table ${Type.GetTableName(type)};`
                                    );
                                    await connection.CloseAsync();
                                }
                            }

                            await context.UpdateDatabaseAsync();

                            for (const type of context.GetMappedTypes()) {
                                expect(
                                    await manager.CheckTableAsync(type)
                                ).toBeTruthy();

                                for (const column of Type.GetColumnNameAndType(type)) {
                                    expect(
                                        await manager.CheckColumnAsync(
                                            type,
                                            column.Field
                                        )
                                    ).toBeTruthy();
                                }
                            }

                        },
                        err => {
                            throw err;
                        }
                    );

                },
                5_000_000
            );

            test(
                "should validate the column type",
                async () => {

                    const { connection, manager } = createManager();

                    let exists = await manager.CheckColumnAsync(Person, "Name");

                    if (exists) {
                        await connection.OpenAsync();
                        await connection.ExecuteNonQueryAsync(
                            "alter table person_tb drop column name;"
                        );
                        await connection.CloseAsync();
                    }

                    await manager.CreateColumnAsync(Person, "Name");

                    const type = await manager.CheckColumnTypeAsync(
                        Person,
                        "Name"
                    );

                    expect(type).toBe("text");

                }
            );

            test(
                "should change a column type when it differs from the model",
                async () => {

                    const { connection, manager } = createManager();

                    let exists = await manager.CheckColumnAsync(Person, "CEP");

                    if (exists) {
                        await connection.OpenAsync();
                        await connection.ExecuteNonQueryAsync(
                            "alter table person_tb drop column cep;"
                        );
                        await connection.ExecuteNonQueryAsync(
                            "alter table person_tb add column cep bigint;"
                        );
                        await connection.CloseAsync();
                    }

                    expect(
                        await manager.CheckColumnAsync(Person, "CEP")
                    ).toBeTruthy();

                    let type = await manager.CheckColumnTypeAsync(
                        Person,
                        "CEP"
                    );

                    expect(type).toBe("bigint");

                    await manager.ChangeColumnTypeAsync(Person, "CEP");

                    type = await manager.CheckColumnTypeAsync(Person, "CEP");

                    expect(type).toBe("integer");

                }
            );

        });

    });

});
