import 'reflect-metadata';
import { Person } from './classes/TestEntity';
import { Operation } from 'myorm_core';
import {CompleteSeedAsync, LeftJoinSeedAsync} from './functions/TestFunctions';
import { Message } from './classes/RelationEntity';


describe("Context", ()=>{    

    test("Testing left join with right side is array and have relation with left", async ()=>{
       
        let context = await LeftJoinSeedAsync();

        let msgs = await context.From(Message)
                               .LeftJoin(Person)
                               .On(Person, "Id", Message, "To")       
                               .Where(Person, {
                                Field: 'Id', 
                                Value: undefined
                               } )
                               .Select(Message)
                               .Load("To").ToListAsync();
        
        
        expect(msgs.length).toBe(2);
          
        
    },5^100000);

    test("Testing the same with array using conventional query sintax", async()=>{

        let context = await LeftJoinSeedAsync();

       

        let msgs = await context.Messages.Where(
            {
                Field : "To",                
                Value : []
            }).Load("To").ToListAsync();

        expect(msgs.length).toBe(2);
                   
    },5^100000);

   
    
    test("Testing left join with right side is array, but left side nort, and left side have relation with right", async ()=>{
       
        let context = await LeftJoinSeedAsync();

        let personsWithNoOneMessageReceived = await context.From(Person)
                               .LeftJoin(Message)
                               .On(Person, "Id", Message, "To") 
                                .Where(Message, 
                                        {
                                            Field : "Id",                                            
                                            Value : undefined
                                        })
                               .Select(Person).Load("MessagesReceived").ToListAsync();
     

        expect(personsWithNoOneMessageReceived.length).toBe(1);       
        expect(personsWithNoOneMessageReceived[0].Name).toBe("ana");       
               
        
    },5^100000);

     test("Testing the same with array using conventional query sintax", async()=>{

        let context = await LeftJoinSeedAsync();

        let personsWithNoOneMessageReceived = await context.Persons.Where(
            {
                Field : "MessagesReceived",                
                Value : []
            }).Load("MessagesReceived").ToListAsync();

        expect(personsWithNoOneMessageReceived.length).toBe(1);
                   
    },5^100000);

    
    
});