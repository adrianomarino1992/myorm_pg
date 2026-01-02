import 'reflect-metadata';
import { InvalidOperationException } from "../src/Index";
import { Message } from "./classes/RelationEntity";
import { Person } from "./classes/TestEntity";
import { CompleteSeedAsync, TruncatePersonTableAsync } from "./functions/TestFunctions";


beforeAll(async()=>{
    await TruncatePersonTableAsync();
})
describe("Select objects ", ()=>{

    

    test("Should return messages with no FROM property", async()=>{
        
        let context = await CompleteSeedAsync();

        let objects = await context.Messages.Load('From').SelectAsync(['Id', 'Message', 'From']);      
                
        let object = objects[0];
        
        let keys = Object.getOwnPropertyNames(object);

        expect(keys.length).toBe(3);

        expect('Id' in object).toBeTruthy();
        expect('Message' in object).toBeTruthy();
        expect('From' in object).toBeTruthy();
        
    }, 10000);    
    

    test("Should return messages with no FROM property on JOIN", async()=>{
        
        let context = await CompleteSeedAsync();

        let objects = await context.From(Message)
                                    .LeftJoin(Person)
                                    .On(Message, 'To', Person, 'Id')
                                    .Select(Message)
                                    .Load('From')
                                    .SelectAsync(['Id', 'Message', 'From']);
                
        let object = objects[0];
        
        let keys = Object.getOwnPropertyNames(object);

        expect(keys.length).toBe(3);

        expect('Id' in object).toBeTruthy();
        expect('Message' in object).toBeTruthy();
        expect('From' in object).toBeTruthy();
        
    }, 10000); 



});