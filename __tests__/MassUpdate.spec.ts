
import { Operation } from 'myorm_core';
import {CompleteSeedAsync, TruncateTablesAsync} from './functions/TestFunctions';


describe("Mass operations", ()=>{    

    test("Should update all entities of an table", async ()=>{
       
        let context = await CompleteSeedAsync();

        await context.Persons.Set("Age", 30).UpdateSelectionAsync();
        
        let all = await context.Persons.ToListAsync();
        
        for(let c of all)
            expect(c.Age).toBe(30);             
        
    },500000);   

    test("Should update some entities of an table", async ()=>{
       
        let context = await CompleteSeedAsync();

        await context.Persons.Set("Age", 30).Where({Field : "Name", Kind : Operation.STARTWITH, Value : "a"}).UpdateSelectionAsync();
        
        let all = await context.Persons.ToListAsync();
        
        let withA : string[]= [];

        for(let c of all)
        {
            if(c.Name.indexOf('a') == 0){
                expect(c.Age).toBe(30);
                withA.push(c.Name);
            }
        }  
        
        expect(all.length).not.toBe(withA.length);       
        
    }, 500000);     
    
    test("Should update a relation field of all entities of an table", async ()=>{
       
        let context = await CompleteSeedAsync();

        let person = await context.Persons.FirstOrDefaultAsync();

        await context.Messages.Set('From', person).UpdateSelectionAsync();

        person = await context.Persons
                                .Where({Field : "Id", Value : person?.Id!})
                                .Load("MessagesWriten")
                                .FirstOrDefaultAsync();
        
        let all = await context.Messages.Load("From").ToListAsync(); 

        for(let c of all)
        {
            expect(c.From?.Name).toBe(person!.Name); 
            expect(c.From?.Id).toBe(person!.Id); 
            expect(person?.MessagesWriten!.filter(s => s.Id == c.Id).length! > 0).toBeTruthy();
        }         
                      
        
    }, 500000);  


    test("Should update a many to many relation field of all entities of an table", async ()=>{
       
        let context = await CompleteSeedAsync();

        let person = await context.Persons
                                  .Load("MessagesReceived")
                                  .FirstOrDefaultAsync();

        await context.Messages.Set('To', [person!]).UpdateSelectionAsync();

        person = await context.Persons
                                .Where({Field : "Id", Value : person?.Id!})
                                .Load("MessagesReceived")
                                .FirstOrDefaultAsync();
        
        let all = await context.Messages.Load("To").ToListAsync(); 

        for(let c of all)
        {
            expect(c.To).toBeDefined(); 
            expect(c.To![0].Name).toBe(person!.Name); 
            expect(c.To![0].Id).toBe(person!.Id); 
            expect(person?.MessagesReceived!.filter(s => s.Id == c.Id).length! > 0).toBeTruthy();
        }         
                      
        
    }, 500000);  


    
    describe("Delete some lines", ()=>{   

        test("Deleting some lines of table", async ()=>{
            
            let context = await CompleteSeedAsync();            

            await context.Persons.Where({Field : "Name", Kind : Operation.STARTWITH, Value : "a"}).DeleteSelectionAsync();
            
            let all = await context.Persons.ToListAsync();
                        
            expect(all.length).toBe(2);     
            expect(all.filter(s => s.Name.indexOf("a") == 0).length).toBe(0)  
            
        },500000);  
    });
    
});
