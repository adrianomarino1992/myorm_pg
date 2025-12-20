# myorm_pg

**myorm_pg** is a lightweight ORM written in **TypeScript** for **PostgreSQL**, inspired by the syntax and development experience of **MyORMForPostgreSQL (.NET)**.

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

## TypeScript Configuration

Decorators must be enabled in your `tsconfig.json`:

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```
---



# Entities

Entities represent database tables and are defined using TypeScript classes combined with decorators.
Decorators are responsible for mapping classes, properties, and relationships directly to PostgreSQL structures.

## Decorator Overview

### @Table
Defines the database table name associated with the entity.

### @Column
Marks a class property as a table column.
An optional parameter allows you to specify a custom column name.

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
    @Column()
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
    @Column()
    @DataType(DBTypes.INTEGER)
    public CEP!: number;

    // PostgreSQL TEXT[]
    @Column()
    @DataType(DBTypes.TEXTARRAY)
    public PhoneNumbers!: string[];

    // PostgreSQL INTEGER[]
    @Column()
    @DataType(DBTypes.INTEGERARRAY)
    public Documents!: number[];

    // PostgreSQL DATE
    @Column()
    @DataType(DBTypes.DATE)
    public Birth!: Date;

    // One person can write many messages
    @Column()
    @OneToMany(() => Message, "From")
    public MessagesWriten?: Message[];

    // Many persons can receive many messages
    @Column()
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
    @Column()
    @DataType(DBTypes.SERIAL)
    public Id : number = -1;

    // Text column
    @Column()
    public Message : string;

    // One person can write many messages
    @Column()
    @ManyToOne(()=> Person, "MessagesWriten")
    public From? : Person;

    // Many persons can receive many messages
    @Column()  
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



## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)