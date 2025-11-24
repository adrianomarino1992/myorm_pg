# myorm_pg

myorm_pg is a ORM writen with TypeScript with sintax similar with MyORMForPostgreSQL of .NET

## Installation



```bash
npm install myorm_pg
```
Enable decorators on tsconfig.json
```json
"experimentalDecorators": true,                   
"emitDecoratorMetadata": true,
```


# Usage
This ORM is based on https://www.nuget.org/packages/Adr.MyORMForPostgreSQL for .NET. The usage is similar.


### Context.ts

```typescript
import { PGDBManager, PGDBContext, PGDBSet} from 'myorm_pg';
import { Message } from './entities/Message'; 
import { Person } from './entities/Person';


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
### Create with explicts parameters
 
```typescript

var context = new Context(PGDBManager.Build("localhost", 5432, "test_db", "username", "password"));

await context.UpdateDatabaseAsync();

```

### Create with enviroment variables 

this method will try get values from __process.env__ keys. The ORM will search for __DB_HOST__, __DB_PORT__, __DB_NAME__, __DB_USER__ and __DB_PASS__

 
 
```typescript

var context = new Context(PGDBManager.BuildFromEnviroment());

await context.UpdateDatabaseAsync();


```



## Insert entities

```typescript

let person = new Person();
person.Name = "Adriano";
person.Email = "adriano@test.com";
person.Birth = new Date(1970,01,01);
person.Documents = [123,4,5,678,9];
person.PhoneNumbers = ['+55(55)1234-5678'];

await context.Persons.AddAsync(person);

```


## Insert entities with relation
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

# where


```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();

```

# And


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


# Or


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


# Operations

### Equals

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();

```


### Not equals

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Kind : Operation.NOTEQUALS,
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();

```

### Contains

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Email',
                                          Kind : Operation.CONTAINS,
                                          Value : 'test@.com'
                                         })
                                   .ToListAsync();
```


### Starts with

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Kind : Operation.STARTWITH,
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();
```


### Ends with

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Kind : Operation.ENDWITH,
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();
```

### Greater 

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Age',
                                          Kind : Operation.GREATER,
                                          Value : 30
                                         })
                                   .ToListAsync();
```

### Smaller

```typescript

let persons = await context.Persons.Where({
                                          Field : 'Name',
                                          Kind : Operation.SMALLER,
                                          Value : 'Adriano'
                                         })
                                   .ToListAsync();

```

# Load
We can load all related entities
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


## Order by

```typescript
let all = await context.Persons
                       .OrderBy('Name')
                       .ToListAsync();
```

## Order by descending

```typescript
let all = await context.Persons
                              .OrderByDescending('Name')
                              .ToListAsync();
```


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


## Update person

```typescript
let person = await context.Persons.Where({
                                         Field : 'Name',                                                 
                                         Value : 'Adriano'
                                        })   
                                  .FirstOrDefaultAsync();

person.Name = "Adriano Marino";
await context.Persons.UpdateAsync(person);

```




## Delete

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


# Inner and Left Join
We can execute complex join operation 

```typescript 
let messagesToCamila = await context.From(Person)
                               .InnerJoin(Message)
                               .On(Person, "Id", Message, "To")       
                               .Where(Person, 
                                    {
                                        Field : "Name",
                                        Kind : Operation.CONSTAINS, 
                                        Value : "camila"
                                    })
                               .Select(Message).Load("To").ToListAsync();
```

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

# Free hand query

```typescript
 let persons = await context.Persons.WhereAsString(`age > 30 or name ilike '%adriano%'`).ToListAsync();

```


# Method to run queries with connection manager system

```typescript
 let pg_result = await context.ExecuteQuery("select now()");

```


# Entities used in this example


### ./entities/Person.ts

```typescript
import { Table, Column, PrimaryKey, DataType, OneToMany, OneToOne, ManyToMany, DBTypes} from 'myorm_pg';
import { Message } from './Message';

@Table("person_tb")
export class Person
{
    @PrimaryKey()
    @Column()
    @DataType(DBTypes.SERIAL)
    public Id : number;

    @Column()
    public Name : string;

    @Column("email_address")
    public Email : string;

    @Column()    
    public Age : number; 
    

    @Column()
    @DataType(DBTypes.INTEGER)
    public CEP : number; 


    @Column()
    @DataType(DBTypes.TEXTARRAY)
    public PhoneNumbers : string[];

    @Column()
    @DataType(DBTypes.INTEGERARRAY)
    public Documents : number[];

    @Column()
    @DataType(DBTypes.DATE)
    public Birth : Date;


    @Column()
    @OneToMany(()=> Message, "From")
    public MessagesWriten? : Message[];

    @Column()
    @ManyToMany(()=> Message, "To")
    public MessagesReceived? : Message[];

  
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

### ./entities/Message.ts

```typescript
import { Table, Column, PrimaryKey, DataType, ManyToOne, ManyToMany, DBTypes} from 'myorm_pg';
import { Person } from './Person';

@Table("message_tb")
export class Message
{
    @PrimaryKey()
    @Column()
    @DataType(DBTypes.SERIAL)
    public Id : number = -1;

    @Column()
    public Message : string;

    @Column()
    @ManyToOne(()=> Person, "MessagesWriten")
    public From? : Person;

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

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)