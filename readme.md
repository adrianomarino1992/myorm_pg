# myorm_pg

**myorm_pg** is a lightweight ORM written in **TypeScript** for **PostgreSQL**.

It focuses on:
- Strongly typed entities
- Decorator-based mapping
- Fluent and expressive queries
- Automatic relationship handling
- Simple database lifecycle management

---

## Installation

```bash
npm install myorm_pg
```

---
## Configuration

#### Peer Dependencies

This ORM relies on the `reflect-metadata` package to enable runtime type reflection used by decorators.

Make sure it is installed and imported **once** in your application entry point:

```typescript
import 'reflect-metadata';
```

#### Typescript

Decorators and metadata emission must be enabled in your `tsconfig.json`:

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

These options are required for entity mapping, dependency injection, and relationship metadata to work correctly.

---



# Entities

Entities represent database tables and are defined using TypeScript classes combined with decorators.
Decorators are responsible for mapping classes, properties, and relationships directly to PostgreSQL structures.

## Decorator Overview

### @Table
Defines the database table name associated with the entity.

### @Column
Marks a class property as a table column.

You may optionally provide a custom column name as a parameter.

If any other column-related decorator is applied to the property, the `@Column` decorator becomes optional — except when you want to explicitly define the column name.

### @PrimaryKey
Indicates that the column is the primary key of the table.

### @DataType
Explicitly defines the PostgreSQL data type for the column using DBTypes.

## Relationship decorators
Define how entities relate to each other and how foreign keys and junction tables are generated:



### @OneToMany
- Defines a one-to-many relationship. One entity instance is related to many instances of another entity

- Does NOT create a foreign key by itself

- Must always be paired with a corresponding **@ManyToOne** on the other side

- The foreign key is created on the many side
#### Example

```typescript
// Person.ts
@OneToMany(() => Message, "From")
public MessagesWriten?: Message[];
```
```typescript
// Message.ts
@ManyToOne(() => Person, "MessagesWriten")
public From?: Person;
```



### @ManyToOne
- Defines the owning side of a one-to-many relationship.

- Many records point to one record

- This is the side responsible for persisting the relationship

#### Example

```typescript
// Message.ts
@ManyToOne(() => Person, "MessagesWriten")
public From?: Person;
```


### @ManyToMany

- Defines a many-to-many relationship.

- Many records relate to many records

- You do not need to define the junction entity manually

#### Example:

```typescript
// Person.ts
@ManyToMany(() => Message, "To")
public MessagesReceived?: Message[];
```
```typescript
// Message.ts
@ManyToMany(() => Person, "MessagesReceived")
public To?: Person[];
```

### @OneToOne

- Defines a one-to-one relationship.

- One record is associated with exactly one record



#### Example:

```typescript
// Person.ts
@OneToOne(() => Profile, "Person")
public Profile?: Profile;
```
```typescript
// Profile.ts
@OneToOne(() => Person, "Profile")
public Person?: Person;
```



## Example of entities


### Person.ts

```typescript
import { Table, Column, PrimaryKey, DataType, OneToMany, OneToOne, ManyToMany, DBTypes} from 'myorm_pg';
import { Message } from './Message';

@Table("person_tb")
export class Person
{
    // Primary key with SERIAL (auto-increment)
    @PrimaryKey()   
    @DataType(DBTypes.SERIAL)
    public Id!: number;

    // Simple text column
    @Column()
    public Name!: string;

    // Column with custom database name
    @Column("email_address")
    public Email!: string;

    // Numeric column
    @Column()
    public Age!: number;

    // Explicit integer column    
    @DataType(DBTypes.INTEGER)
    public CEP!: number;

    // PostgreSQL TEXT[]   
    @DataType(DBTypes.TEXTARRAY)
    public PhoneNumbers!: string[];

    // PostgreSQL INTEGER[]   
    @DataType(DBTypes.INTEGERARRAY)
    public Documents!: number[];

    // PostgreSQL DATE    
    @DataType(DBTypes.DATE)
    public Birth!: Date;

    // One person can write many messages    
    @OneToMany(() => Message, "From")
    public MessagesWriten?: Message[];

    // Many persons can receive many messages
    @ManyToMany(() => Message, "To")
    public MessagesReceived?: Message[];

  
    constructor(name : string = "", email : string = "", age : number = 1)
    {
        this.Id = -1;
        this.Name = name;
        this.Email = email;
        this.Age = age;
        this.CEP = -1;
        this.PhoneNumbers = [];
        this.Birth = new Date(1992,4,23);       
        this.Documents = []; 
        this.MessagesReceived = [];
        this.MessagesWriten = [];
       
    }
       

}
```

### Message.ts

```typescript
import { Table, Column, PrimaryKey, DataType, ManyToOne, ManyToMany, DBTypes} from 'myorm_pg';
import { Person } from './Person';

@Table("message_tb")
export class Message
{
    // Primary key with SERIAL (auto-increment)
    @PrimaryKey()    
    @DataType(DBTypes.SERIAL)
    public Id : number = -1;

    // Text column
    @Column()
    public Message : string;

    // One person can write many messages    
    @ManyToOne(()=> Person, "MessagesWriten")
    public From? : Person;

    // Many persons can receive many messages    
    @ManyToMany(()=> Person, "MessagesReceived")  
    public To? : Person[];     


    constructor(message : string, from? : Person, to? : Person[])
    {
        this.Message = message;
        this.From = from;
        this.To = to;       
    }
       

}
```

--- 

# Database Context

The database context is the central access point to the database.
It manages:

- The database connection

- Entity sets (PGDBSet<T>)

- Schema synchronization

- Query execution

Each entity must be registered in the context to be tracked and queried by the ORM.

```typescript
import { PGDBManager, PGDBContext, PGDBSet} from 'myorm_pg';
import { Message } from './Message'; 
import { Person } from './Person';


export default class Context extends PGDBContext
{
    public Persons : PGDBSet<Person>;
    public Messages : PGDBSet<Message>;

    constructor(manager : PGDBManager)
    {
        super(manager);  
        this.Persons = new PGDBSet(Person, this);      
        this.Messages = new PGDBSet(Message, this);      
    }
}
```

# Create a instance of context and update or creare database

 
```typescript
const context = new Context(PGDBManager.Build("localhost", 5432, "test_db", "username", "password"));
```

### Create with enviroment variables 

this method will try get values from __process.env__ keys. The ORM will search for __DB_HOST__, __DB_PORT__, __DB_NAME__, __DB_USER__ and __DB_PASS__

 
 
```typescript
const  context = new Context(PGDBManager.BuildFromEnviroment());
```

After creating the context, the database schema can be created or updated automatically based on the entity metadata. 

```typescript
await context.UpdateDatabaseAsync();
```

This process:

- Creates tables if they do not exist

- Updates columns and data types

- Creates foreign keys and junction tables

- Keeps the database schema synchronized with the code
### Create with explicts parameters
 
```typescript

var context = new Context(PGDBManager.Build("localhost", 5432, "test_db", "username", "password"));

await context.UpdateDatabaseAsync();

```
--- 



# Insert entities

```typescript

const person = new Person();
person.Name = "Adriano";
person.Email = "adriano@test.com";
person.Birth = new Date(1970,01,01);
person.Documents = [123,4,5,678,9];
person.PhoneNumbers = ['+55(55)1234-5678'];

await context.Persons.AddAsync(person);

```
---

# Insert entities with relation
In this case, all persons will be saved automatically. All persons of __Message.To__ property will have a reference to this message on property 
__Person.MessagesReceived__ and the person of __Message.From__ will have a reference to this message on __Person.MessagesWriten__ property

```typescript
let msg = new Message("some message to my friends", 
                new Person("Adriano", "adriano@test.com"), 
                [
                    new Person("Camila", "camila@test.com"), 
                    new Person("Juliana", "juliana@test.com"), 
                    new Person("Andre", "andre@test.com")
                ]);

await context.Messages.AddAsync(msg);

```

---
# Query

## where


```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();

```

## And


```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Value : 'Adriano'
                                         })
                                    .And({
                                          Field : 'Email',
                                          Value : 'adriano@test.com'
                                         })
                                   .ToListAsync();

```


## Or


```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Value : 'Adriano'
                                         })
                                    .Or({
                                          Field : 'Email',
                                          Value : 'adriano@test.com'
                                         })
                                   .ToListAsync();

```

---

# Operations

## Equals

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();

```


## Not equals

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Kind : Operation.NOTEQUALS,
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();

```

## Contains

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Email',
                                          Kind : Operation.CONTAINS,
                                          Value : 'test@.com'
                                         })
                                   .ToListAsync();
```


## Starts with

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Kind : Operation.STARTWITH,
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();
```


## Ends with

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Kind : Operation.ENDWITH,
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();
```

## Greater 

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Age',
                                          Kind : Operation.GREATER,
                                          Value : 30
                                         })
                                   .ToListAsync();
```

## Smaller

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Kind : Operation.SMALLER,
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();

```
--- 
# Load related entities

```typescript

let persons = await context.Persons.Where({
                                           Field : 'Name',
                                           Value : 'Adriano'
                                           })
                                   .Join("MessagesReceived")
                                   .ToListAsync(); 

```
This query will retrive from database all persons with name "Adriano" and will load all messages receiveds base on relations attributes


# Reload relations from entities
We can reload all related entities on a object that is not already loaded from database
```typescript

let messages = await context.Messages.ToListAsync(); // will load only the root(Message) object from database

await context.Messages.ReloadCachedRealitionsAsync(messages, ["To"]); //will load/reload the "TO" property of all messages with Person objects


```
This query will load/reload the "TO" property of all messages with Person objects


---

# Joins
We can create complex Joins

### Inner join
```typescript 
   let msgs = await context.From(Person)
                           .InnerJoin(Message)
                           .On(Person, "Id", Message, "To")      
                           .Where(Person,{
                                         Field : "Name",                 
                                         Value : "camila"
                                        })
                          .Where(Message, {
                                           Field : "Date",
                                           Kind : Operation.GREATHEROREQUALS, 
                                           Value : new Date(2023,0,1)
                                           })
                         .Select(Message).Load("To").ToListAsync();
```

This query will retrieve from database all messages sent to a person with name "camila" and that are sent this year.


### Left join
```typescript 
   let msgs = await context.From(Person)
                           .LeftJoin(Message)
                           .On(Person, "Id", Message, "To")                                
                           .Where(Message, {
                                           Field : "Id",                                       
                                           Value : undefined
                                           })
                          .Select(Person).ToListAsync();
```

This query will retrieve from database all persos who have no one message received.



## Order by

```typescript
let all = await context.Persons
                       .OrderBy('Name')
                       .ToListAsync();
```


---
# Ordering and Limit
## Order by descending

```typescript
let all = await context.Persons
                              .OrderByDescending('Name')
                              .ToListAsync();
```

---
## Limit

```typescript
let all = await context.Persons
                              .OrderBy('Name')
                              .Limit(10)
                              .ToListAsync();
```

## Get first or default 

```typescript
let person  = await context.Persons.Where({
                                        Field : 'Name',                                                 
                                        Value : 'Adriano'
                                         })
                                  .FirstOrDefaultAsync();
```



--- 
# Update 

```typescript
let person = await context.Persons.Where({
                                         Field : 'Name',                                                 
                                         Value : 'Adriano'
                                        })   
                                  .FirstOrDefaultAsync();

person.Name = "Adriano Marino";
await context.Persons.UpdateAsync(person);

```

--- 


# Delete

```typescript
let person = await context.Persons.Where({
                                         Field : 'Name',                                                 
                                         Value : 'Adriano'
                                        }).FirstOrDefaultAsync();

await context.Persons.DeleteAsync(person);
```


# Delete or update many registers

## DeleteSelectionAsync
```typescript 
 await context.Persons.Where({
                                Field : 'Age',                                                 
                                Value : 20
                                })
                      .DeleteSelectionAsync();
```

## UpdateSelectionAsync
```typescript 
 await context.Persons.Set('Age', 30)
                      .Where({
                                Field : 'Age',                                                 
                                Value : 20
                                })
                      .UpdateSelectionAsync();
```

---


# Transactions

This ORM provides first-class support for database transactions, including **begin**, **commit**, **rollback**, and **savepoints**.  
This allows you to safely group multiple operations and partially rollback changes when needed.

### Basic Usage

You can manually control a transaction using the context API:

```typescript
await context.BeginTransactionAsync();

// database operations...

await context.CommitAsync();
```
If something goes wrong, you can rollback the entire transaction:

```typescript
await context.RollBackAsync();
```


### Full Rollback Example

In this example, **any error** causes the entire transaction to be rolled back:

```typescript
await context.BeginTransactionAsync();

try 
{
    await context.Persons.AddAsync(person1);
    await context.Persons.AddAsync(person2);

    await context.Messages.AddAsync(message);

    await context.CommitAsync();
}
catch (error) 
{
    // Reverts all operations executed within the transaction
    await context.RollBackAsync();
    throw error;
}
```
What happens here:

- All operations are executed inside a single transaction

- If any step fails, no data is persisted

- The transaction is only committed if everything succeeds

## Savepoint with Partial Rollback Example

Savepoints allow you to protect a specific section of a transaction.


```typescript
await context.BeginTransactionAsync();

try 
{
    await context.Persons.AddAsync(person1);
    await context.Persons.AddAsync(person2);
    await context.Persons.AddAsync(person3);
    await context.Persons.AddAsync(person4);

    // Creates a savepoint after all persons are added
    await context.SavePointAsync("persons");

    await context.Messages.AddAsync(message);

    // Something went wrong while saving the message
    throw new Error("Message validation failed");

    await context.CommitAsync();
}
catch (error) 
{
    // Rollback only the operations after the savepoint
    await context.RollBackAsync("persons");

    // Commit everything that happened before the savepoint
    await context.CommitAsync();
}

```
Result:

- All Person entities are saved

- The Message entity is discarded

- The transaction completes successfully

## Recommended Pattern
```typescript
await context.BeginTransactionAsync();

try 
{
    // operations
    await context.CommitAsync();
} 
catch 
{
    await context.RollBackAsync();
    throw;
}
```
Using `try/catch` with transactions is strongly recommended to guarantee data integrity and predictable behavior.

---

# Fluent query methods

## Where

```typescript 
let persons= await context.Persons.WhereField("Name").Constains("Adriano")
                                  .AndLoadAll("MessagesReceived")
                                  .ToListAsync();
```

## And and Or

```typescript 
 let persons = await context.Persons.WhereField("Name").Constains("Adriano")
                                    .AndField("Age").IsGreaterThan(30)
                                    .OrField("Email").Constains("@test.com")
                                    .AndLoadAll("MessagesReceived")
                                    .ToListAsync();
```

## IsInsideIn

```typescript 
 let persons = await context.Persons.WhereField("Age").IsInsideIn([1,30, 12, 40, 120]).ToListAsync();
```

### This is equilalent to : 

```typescript 
let persons  = await context.Persons.Where({Field : 'Age', Value : 1})
                                    .Or({Field : 'Age', Value : 30})
                                    .Or({Field : "Age" , Value : 12})
                                    .Or({Field : "Age" , Value : 40})
                                    .Or({Field : "Age" , Value : 120})
                                    .ToListAsync();
```

## Get null

```typescript
let persons = await context.Persons.WhereField("MessagesReceived").IsNull().ToListAsync();      
```  

--- 
# Free hand query

```typescript
 let persons = await context.Persons.WhereAsString(`age > 30 or name ilike '%adriano%'`).ToListAsync();
```


# Method to run queries with connection manager system

```typescript
 let pg_result = await context.ExecuteQuery("select now()");
```



# GetTypeMapping (Type Mapping Helper)

The `PGDBSet<T>.GetTypeMapping()` feature exposes metadata about an entity mapping, allowing you to safely build **dynamic SQL statements** based on entity definitions, column mappings, and relationships — without hardcoding table or column names.

This is especially useful for:
- Dynamic queries
- Custom SQL generation
- Debugging mappings
- Advanced filtering scenarios

### Basic Usage
```typescript

let helper =  context.Persons.GetTypeMapping();

```
The returned helper provides access to:

- Table → mapped table name

- Columns → mapped column names

- EvaluateStatement() → generates SQL expressions from strongly-typed filters


#### Update example
```typescript

let helper =  context.Persons.GetTypeMapping();

let person = await context.Persons.OrderBy("Age").FirstOrDefaultAsync();

let update = `update ${helper.Table} 
              set ${helper.Columns.Age} = ${helper.Columns.Age} - 1 
              where ${helper.Columns.Id} = ${person?.Id}`; 


let rowCount = (await context.ExecuteQuery(update)).rowCount; 
```

#### Select using EvaluateStatement()
```typescript
const helper = context.Persons.GetTypeMapping();

const whereClause = helper.EvaluateStatement({
    Field: "Age",
    Value: 20
});

const select = `select ${helper.Columns.Name}, ${helper.Columns.Email} from ${helper.Table} where ${whereClause}`;

```

#### Querying using relation fields

```typescript

const helper = context.Persons.GetTypeMapping();

const whereClause = helper.EvaluateStatement({
    Field: "MessagesReceived",
    Kind: Operation.CONTAINS,
    Value: [messageObject]
});

const select = `select ${helper.Columns.Id} from ${helper.Table} where ${whereClause}`; 
 
```

`GetTypeMapping()` gives you a low-level but type-aware view of your entity mapping:

- No hardcoded table or column names

- Safe dynamic SQL generation

- Works with scalar fields and relations

- Ideal for advanced scenarios where LINQ-like APIs are not enough


---


## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)