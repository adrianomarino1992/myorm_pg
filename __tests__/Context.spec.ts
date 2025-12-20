
import { Person } from './classes/TestEntity';
import { Operation } from 'myorm_core';
import {TruncatePersonTableAsync, CreateContext, SeedAsync, CompleteSeedAsync} from './functions/TestFunctions';
import TypeNotMappedException from '../src/core/exceptions/TypeNotMappedException';



beforeAll(async()=>{
    await TruncatePersonTableAsync();
})

describe("Context", ()=>{    

    
    test("Testing constructor", async ()=>{
       
        let context = CreateContext();
        
        expect(context).not.toBeNull();

        expect(context.Persons).not.toBeNull();
        
    });


    test("Testing access some collection", async ()=>{

        expect.assertions(3);

        let context = CreateContext();

        let collection = context.Collection(Person);

        try
        {
            let fail  = context.Collection(String);
        }
        catch(e)
        {
            expect(e instanceof TypeNotMappedException).toBeTruthy();
        }

        expect(collection).not.toBeNull();

        expect(collection).toBe(context.Persons);

       
        
    });
    

    describe("Query", ()=>{

        test("Selecting an entity in real database", async ()=>{
       
            let context = await SeedAsync();
    
            let adrianos = await context.Persons
                                        .Where(
                                            {
                                                Field : 'Name', 
                                                Kind: Operation.EQUALS, 
                                                Value : 'Adriano'
                                            }).Load("MessagesReceived")
                                        .ToListAsync();
    
            let all = await context.Persons.ToListAsync();
                                        
            expect(all.length).toBe(4);
            expect(adrianos.length).toBe(1);   
            expect(adrianos[0].Name).toBe("Adriano");
            expect(adrianos[0].Email).toBe("adriano@test.com");
            expect(adrianos[0].Birth).toEqual(new Date(1992,4,23));
            expect(adrianos[0].Documents).toEqual([123,4,5,678,9]);
            expect(adrianos[0].PhoneNumbers).toEqual(['+55(12)98206-8255']);
            
    
            await TruncatePersonTableAsync();              
    
        });

         test("Selecting an entity using a null value", async ()=>{
       
            let context = await CompleteSeedAsync();
    
            let mgs = await context.Messages
                                        .Where(
                                            {
                                                Field : 'LinkTestValueInMessage',                                                 
                                                Value : undefined
                                            })
                                        .ToListAsync();
    
           

            expect(mgs.length).toBe(1);
            expect(mgs[0].Message).toBe('Some message from Camila');
            
    
            await TruncatePersonTableAsync();              
    
        });

        test("AsUntracked", async ()=>{
       
            let context = await SeedAsync();
    
            let adrianos = await context.Persons
                                        .Where(
                                            {
                                                Field : 'Name', 
                                                Kind: Operation.EQUALS, 
                                                Value : 'Adriano'
                                            }).Load("MessagesReceived")
                                        .AsUntrackeds()
                                        .ToListAsync();
    
            
                                        
            
            expect(adrianos.length).toBe(1);   
            expect(adrianos[0].Name).toBe("Adriano");
            expect(adrianos[0].Email).toBe("adriano@test.com");
            expect(adrianos[0].Birth).toEqual(new Date(1992,4,23));
            expect(adrianos[0].Documents).toEqual([123,4,5,678,9]);
            expect(adrianos[0].PhoneNumbers).toEqual(['+55(12)98206-8255']);
            expect(adrianos.filter(s => (s as any)["_orm_metadata_"] != undefined).length).toBe(0);
            
    
            await TruncatePersonTableAsync();              
    
        });

        

        describe("Quering array", ()=>{

            test("Selecting an entity in real database that documents contains 5", async ()=>{
           
                let context = await SeedAsync();
        
                let persons = await context.Persons
                                            .Where(
                                                {
                                                    Field : 'Documents', 
                                                    Kind: Operation.CONSTAINS, 
                                                    Value : [5]
                                                })
                                            .ToListAsync();               
                                            
                
                expect(persons.length).toBe(1);   
                expect(persons[0].Name).toBe("Adriano");
                expect(persons[0].Email).toBe("adriano@test.com");
                expect(persons[0].Birth).toEqual(new Date(1992,4,23));
                expect(persons[0].Documents).toEqual([123,4,5,678,9]);
                expect(persons[0].PhoneNumbers).toEqual(['+55(12)98206-8255']);
                
        
                await TruncatePersonTableAsync();              
        
            });
        });
    });

    

    describe("Ordenation", ()=>{
        
        test("Testing order by asc and desc", async ()=>{
       
            let context = await SeedAsync();
            
            let all = await context.Persons.OrderBy('Name').ToListAsync();
                                        
            expect(all.length).toBe(4);
            expect(all[0].Name).toBe("Adriano");   
            expect(all[1].Name).toBe("Andre");   
            expect(all[2].Name).toBe("Camila");   
            expect(all[3].Name).toBe("Juliana");  
            
            all = await context.Persons.OrderDescendingBy('Name').ToListAsync();                                       
            
            
            expect(all.length).toBe(4);
            expect(all[3].Name).toBe("Adriano");   
            expect(all[2].Name).toBe("Andre");   
            expect(all[1].Name).toBe("Camila");   
            expect(all[0].Name).toBe("Juliana"); 
            
            await TruncatePersonTableAsync();
    
        });


        test("Testing order by asc and offset", async ()=>{
       
            let context = await SeedAsync();
            
            let all = await context.Persons.OrderBy('Name').Offset(1).Limit(2).ToListAsync();
                                        
            expect(all.length).toBe(2);             
            expect(all[0].Name).toBe("Andre");   
            expect(all[1].Name).toBe("Camila"); 
            
            await TruncatePersonTableAsync();
    
        });
        
    });

    describe("Count and exists", ()=>{
        
        test("Testing Count all", async ()=>{
       
            let context = await SeedAsync();
            
            let count = await context.Persons.CountAsync();
            
            expect(count).toBe(4);

            await TruncatePersonTableAsync();
    
        });


        test("Testing Count with where", async ()=>{
       
            let context = await SeedAsync();
            
            let count = await context.Persons.Where({Field: 'Name', Kind: Operation.CONSTAINS, Value: 'adriano'}).CountAsync();
            
            expect(count).toBe(1);

            await TruncatePersonTableAsync();
    
        });

        test("Testing Exists all", async ()=>{
       
            let context = await SeedAsync();
            
            let exists = await context.Persons.ExistsAsync();
            
            expect(exists).toBeTruthy();

            await TruncatePersonTableAsync();

            exists = await context.Persons.ExistsAsync();
            
            expect(exists).toBeFalsy();    
        });


        test("Testing Exists with where", async ()=>{
       
            let context = await SeedAsync();
            
            let exists = await context.Persons.Where({Field: 'Name', Kind: Operation.CONSTAINS, Value: 'adriano'}).ExistsAsync();
            
            expect(exists).toBeTruthy();

            await TruncatePersonTableAsync();

            exists = await context.Persons.Where({Field: 'Name', Kind: Operation.CONSTAINS, Value: 'adriano'}).ExistsAsync();
            
            expect(exists).toBeFalsy();    
        });
        
    });
    
    
    describe("Update an entity", ()=>{

        test("Updating an entity in real database", async ()=>{
       
            let context = await SeedAsync();
    
            let adriano = await context.Persons
                                        .Where(
                                            {
                                                Field : 'Name', 
                                                Kind: Operation.EQUALS, 
                                                Value : 'Adriano'
                                            })
                                        .FirstOrDefaultAsync();
    
            expect(adriano).not.toBe(undefined);
    
            adriano!.CEP = 12312000;
            adriano!.Documents = [1, 2, 3, 4, 5, 6];
            adriano!.PhoneNumbers = ["(55)12 98206-8255"];

            await context.Persons.UpdateAsync(adriano!);
    
            adriano = await context.Persons
                                        .Where(
                                            {
                                                Field : 'Name', 
                                                Kind: Operation.EQUALS, 
                                                Value : 'Adriano'
                                            })
                                        .FirstOrDefaultAsync();

            
    
            expect(adriano).not.toBe(undefined);
            expect(adriano!.CEP).toBe(12312000);
            expect(adriano!.Documents).toEqual([1, 2, 3, 4, 5, 6]);
            expect(adriano!.PhoneNumbers).toEqual(["(55)12 98206-8255"]);

            await TruncatePersonTableAsync();              
    
        },1000000);

        describe("Update relations", ()=>{

            test("Updating only one field", async ()=>{
        
                let context = await CompleteSeedAsync();
        
                let message = await context.Messages
                                        .Where({Field : "Message", Kind : Operation.CONSTAINS, Value : "from Adriano to"})
                                        .Load("From")
                                        .Load("To")
                                        .FirstOrDefaultAsync();
        
                expect(message?.Message).toBe("Some message from Adriano to nobody");
        
                message!.From = await context.Persons.WhereField("Name").Constains("camila").FirstOrDefaultAsync()!;

                await context.Messages.UpdateAsync(message!);

                message = await context.Messages
                                    .Where({Field : "Message", Kind : Operation.CONSTAINS, Value : "from Adriano to"})
                                    .Load("From")
                                    .Load("To")
                                    .FirstOrDefaultAsync();

                expect(message?.From?.Name).toBe("camila");

                
                message!.From = await context.Persons.WhereField("Name").Constains("adriano").FirstOrDefaultAsync()!;

                expect(message?.From?.Name).toBe("adriano");

                message!.To = [(await context.Persons.WhereField("Name").Constains("camila").FirstOrDefaultAsync())!];

                await context.Messages.UpdateObjectAndRelationsAsync(message!, ["From"]);

                message = await context.Messages
                                        .Where({Field : "Message", Kind : Operation.CONSTAINS, Value : "from Adriano to"})
                                        .Load("From")
                                        .Load("To")
                                        .FirstOrDefaultAsync();
                
                expect(message?.From?.Name).toBe("adriano");
                expect(message?.To?.length).toBe(0);

                await TruncatePersonTableAsync();              
        
            }, 100000);
        });
    });

    describe("Delete an entity", ()=>{

        test("Deleting an entity in real database", async ()=>{
       
            let context = await SeedAsync();
    
            let adriano = await context.Persons
                                        .Where(
                                            {
                                                Field : 'Name', 
                                                Kind: Operation.EQUALS, 
                                                Value : 'Adriano'
                                            })
                                        .FirstOrDefaultAsync();
    
            expect(adriano).not.toBe(undefined);   
            
            await context.Persons.DeleteAsync(adriano!);
    
            adriano = await context.Persons
                                        .Where(
                                            {
                                                Field : 'Name', 
                                                Kind: Operation.EQUALS, 
                                                Value : 'Adriano'
                                            })
                                        .FirstOrDefaultAsync();
    
            expect(adriano).toBe(undefined);           
            
            await TruncatePersonTableAsync();              
    
        }, 5^10000);
    });

});


