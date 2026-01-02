import 'reflect-metadata';
import { Person } from './classes/TestEntity';
import { Operation } from 'myorm_core';
import { TryAsync , TruncateTablesAsync, CreateContext } from './functions/TestFunctions';
import { Message } from './classes/RelationEntity';



beforeAll(async ()=> await TruncateTablesAsync());


describe("Add objects with relations", ()=>{

    
    test("Add Message with persons and create relations", async()=>{
        
        await TryAsync(async () =>{

            var context = CreateContext();

            let msg = new Message("some message", 
                new Person("Adriano", "adriano@test.com"), 
                [
                    new Person("Camila", "camila@test.com"), 
                    new Person("Juliana", "juliana@test.com"), 
                    new Person("Andre", "andre@test.com")

                ]
                );
    
            await context.Messages.AddAsync(msg);

            let msgfromDB = await context.Messages
            .Where({
                Field : "Id", 
                Value : msg.Id
            })
            .Load('From')
            .Load('To')            
            .FirstOrDefaultAsync();
           
            expect(msgfromDB).not.toBe(undefined);            
            expect(msgfromDB?.From).not.toBe(undefined);
            expect(msgfromDB?.From?.Name).toBe("Adriano");
            expect(msgfromDB?.To?.length).toBe(3);
            expect(msgfromDB!.To![0].Name).toBe("Camila");
            expect(msgfromDB!.To![1].Name).toBe("Juliana");
            expect(msgfromDB!.To![2].Name).toBe("Andre");

            let fromPerson = msg.From;
            let toPersons = msg.To;

            let reloadedFromPerson = await context.Persons.WhereField("Id").IsEqualTo(fromPerson?.Id!).Load("MessagesWriten").FirstOrDefaultAsync();
            let reloadedToPersons = await context.Persons.WhereField("Id").IsInsideIn(toPersons!.map(s => s.Id)).Load("MessagesReceived").ToListAsync();

            expect(reloadedFromPerson).not.toBeUndefined();
            expect(reloadedToPersons.length).toBe(toPersons?.length);

            expect(reloadedFromPerson?.MessagesWriten?.filter(s => s.Id == msg.Id).length).toBe(1);

            for(let to of reloadedToPersons)
                expect(to?.MessagesReceived?.filter(s => s.Id == msg.Id).length).toBe(1);


        }, err => 
        {
            throw err;
        });        
        
    }, 1000000);
    


    

    describe("Update a relationated object", ()=>{

        
        test("Update person of a message without save person directly", async()=>{
        
            await TryAsync(async () =>{
    
                var context = CreateContext();
    
                let person = new Person("Adriano", "adriano@test.com");
                let msg = new Message("some message", person);
        
                await context.Messages.AddAsync(msg);
    
                let personDB = await context.Persons
                .Load('MessagesWriten')
                .Where({
                    Field : "Id",                      
                    Value : person.Id
                })
                .FirstOrDefaultAsync();
                
                expect(personDB).not.toBe(undefined);
                expect(personDB?.MessagesWriten).not.toBe(undefined);
                expect(personDB?.MessagesWriten?.length).toBe(1);     
                
    
            }, err => 
            {
                throw err;
            });      
            
        });

        test("Update message without load person", async()=>{
        
            await TryAsync(async () =>{
    
                var context = CreateContext();
    
                let person = new Person("Adriano", "adriano@test.com");
                let msg = new Message("some message", person);
        
                await context.Messages.AddAsync(msg);
    
                let messageDB = await context.Messages                
                .Where({
                    Field : "Id",                      
                    Value : msg.Id
                })
                .FirstOrDefaultAsync();
                
                expect(messageDB).not.toBe(undefined);
                expect(messageDB?.From).toBe(undefined);


                messageDB!.Message = "Changed without load person";

                await context.Messages.UpdateAsync(messageDB!);

                messageDB = await context.Messages      
                .Load("From")          
                .Where({
                    Field : "Id",                      
                    Value : msg.Id
                })
                .FirstOrDefaultAsync();

                expect(messageDB?.From?.Name).toBe(person.Name);   
                expect(messageDB?.From?.Id).toBe(person.Id);   

                expect(messageDB?.Message).toBe("Changed without load person");     
                
    
            }, err => 
            {
                throw err;
            });      
            
        });

        

        test("Update some destination of a message without save person directly", async()=>{
        
            await TryAsync(async () =>{
    
                var context = CreateContext();
    
                let adriano = new Person("Adriano", "adriano@test.com");
                let camila = new Person("Camila", "camila@test.com");
                let juliana = new Person("Juliana", "juliana@test.com");
                let andre = new Person("Andre", "andre@test.com");

                let msg = new Message("some message", 
                    adriano, 
                    [
                        camila,
                        juliana, 
                        andre
    
                    ]);
        
                await context.Messages.AddAsync(msg);
    
                let camilaDB = await context.Persons
                .Load('MessagesReceived')
                .Where({
                    Field : "Id", 
                    Value : camila.Id
                })
                .FirstOrDefaultAsync();

                let julianaDB = await context.Persons
                .Load('MessagesReceived')
                .Where({
                    Field : "Id", 
                    Value : juliana.Id
                })
                .FirstOrDefaultAsync();
                
                expect(camilaDB).not.toBe(undefined);
                expect(camilaDB?.MessagesWriten).toEqual([]);
                expect(camilaDB?.MessagesReceived?.length).toBe(1);     
                expect(julianaDB?.MessagesReceived?.length).toBe(1);     
                
    
            }, err => 
            {
                throw err;
            });      
            
        }, 20000);

    });

    


    


    
    describe("Update objects with relations", ()=>{

        test("Update Message", async()=>{
            
            await TryAsync(async () =>{
    
                var context = CreateContext();
    
                let msg = new Message("some message", new Person("Adriano", "adriano@test.com"));
        
                await context.Messages.AddAsync(msg);
    
                let msgfromDB = await context.Messages
                .Where({
                    Field : "Id",                    
                    Value : msg.Id
                })
                .Load('From')
                .FirstOrDefaultAsync();
    
                expect(msgfromDB).not.toBe(undefined);
                expect(msgfromDB?.To).toBe(undefined);
                
                msgfromDB!.Message = "Changed";
                msgfromDB!.From = undefined;
    
                await context.Messages.UpdateAsync(msgfromDB!);
    
                msgfromDB = await context.Messages
                .Where({
                    Field : "Id",                      
                    Value : msg.Id
                })
                .Load('From')
                .FirstOrDefaultAsync();
                
                expect(msgfromDB).not.toBe(undefined);
                expect(msgfromDB!.Message).toBe("Changed");
                expect(msgfromDB?.To).toBe(undefined);
                expect(msgfromDB?.From).toBe(undefined);
                
    
            }, err => 
            {
                throw err;
            });      
            
        });
        
        describe("Update a relational object", ()=>{

            test("App Person message relation", async()=>{
            
                await TryAsync(async () =>{
        
                    var context = CreateContext();
        
                    let msg = new Message("some message", new Person("Adriano", "adriano@test.com"));
            
                    await context.Messages.AddAsync(msg);
        
                    let msgfromDB = await context.Messages
                    .Load('From')
                    .Where({
                        Field : "Id", 
                        Kind : Operation.EQUALS, 
                        Value : msg.Id
                    })
                    .FirstOrDefaultAsync();
                    
                    expect(msgfromDB).not.toBe(undefined);
                    expect(msgfromDB?.To).toBe(undefined);
                    expect(msgfromDB?.From).not.toBe(undefined);  
                   
        
                }, err => 
                {
                    throw err;
                });      
                
            });
        });
    });

    
    
  
    
});

