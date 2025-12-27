import { PGDBManager } from "../src/Index";
import InvalidOperationException from "../src/core/exceptions/InvalidOperationException";
import PGConnection from "../src/implementations/PGDBConnection";
import Context from "./classes/TestContext";

describe("Connection", () => {

    test("Should open and close a connection", async () => {

        var conn = new PGConnection("localhost", 5432, "db", "user", "password");

        expect(conn).not.toBe(null);

        await conn.OpenAsync();
        await conn.CloseAsync();

    });


    test("Should open and close a connection using environment variables", async () => {

        process.env.DB_HOST = "localhost";
        process.env.DB_PORT = "5432";
        process.env.DB_USER = "user";
        process.env.DB_PASS = "password";
        process.env.DB_NAME = "db";

        let context = new Context(PGDBManager.BuildFromEnviroment());

        let now = await context.ExecuteQuery("select now()");

        expect(now).not.toBeUndefined();

    });


    describe("Failure scenarios", () => {

        test("Should fail when no environment variables are provided", async () => {

            process.env.DB_HOST = "";
            process.env.DB_PORT = "";
            process.env.DB_USER = "";
            process.env.DB_PASS = "";
            process.env.DB_NAME = "";

            try {
                new Context(PGDBManager.BuildFromEnviroment());
                throw new Error("Expected operation to fail");
            } catch (exception) {
                if (!(exception instanceof InvalidOperationException)) {
                    throw new Error("Unexpected error type");
                }
            }

        });

    });

});
