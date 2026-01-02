import 'reflect-metadata';
import { InvalidOperationException, Operation } from "../src/Index";
import { Message } from "./classes/RelationEntity";
import { Person } from "./classes/TestEntity";
import { CompleteSeedAsync, TruncatePersonTableAsync } from "./functions/TestFunctions";
import Type from '../src/core/design/Type';


beforeAll(async()=>{
    await TruncatePersonTableAsync();
})
describe("Create select query", ()=>{

    

    test("Should return a select of person", async()=>{
        
        let context = await CompleteSeedAsync();

        let helper =  context.Persons.GetTypeMapping();                    
                
        expect(helper.Table).toBe(Type.GetTableName(Person));

        expect(helper.Columns.Age).toBe(Type.GetColumnName(Person, "Age"));

        let select = `select * from ${helper.Table} where ${helper.EvaluateStatement({ Field: "Age", Value: 20})}`;

        expect(select).toBe(`select * from ${Type.GetTableName(Person)} where \"${Type.GetTableName(Person)}\".${Type.GetColumnName(Person, "Age")} = 20`);

        let persons = await context.Persons.WhereAsString(`${helper.EvaluateStatement({ Field: "Age", Value: 20})}`).ToListAsync();

        let rowCount = (await context.ExecuteQuery(select)).rowCount;

        let count = await context.Persons.Where({ Field: "Age", Value: 20}).CountAsync();        

        expect(persons.length).toBe(rowCount);

        expect(persons.length).toBe(count);
        
    }, 10000);    


     test("Should return a select of person using a relation field to query", async()=>{
        
        let context = await CompleteSeedAsync();

        let personsWhoReceivedMessages = await context.Persons.Load("MessagesReceived").ToListAsync();

        let first = personsWhoReceivedMessages[0];

        let helper =  context.Persons.GetTypeMapping();          

        let select = `select * from ${helper.Table} where ${helper.EvaluateStatement({ Field: "MessagesReceived", Kind: Operation.CONTAINS, Value: [first.MessagesReceived![0]]})}`;        

        let persons = await context.Persons.WhereAsString(`${helper.EvaluateStatement({ Field: "MessagesReceived", Kind: Operation.CONTAINS, Value: [first.MessagesReceived![0]]})}`).ToListAsync();

        let rowCount = (await context.ExecuteQuery(select)).rowCount;

        let count = await context.Persons.Where({ Field: "MessagesReceived", Kind: Operation.CONTAINS, Value: [first.MessagesReceived![0]]}).CountAsync();    
        
        expect(persons.filter(s => s.Id == first.Id).length).toBe(1);

        expect(persons.length).toBe(rowCount);

        expect(persons.length).toBe(count);
        
    }, 10000);    
    

     test("Should update a person", async()=>{
        
        let context = await CompleteSeedAsync();

        let helper =  context.Persons.GetTypeMapping();                    
                
        let first = await context.Persons.OrderBy("Name").FirstOrDefaultAsync();

        let select = `update ${helper.Table}  set ${helper.Columns.Name} = 'updated 12345' where ${helper.EvaluateStatement({ Field: "Id", Value: first?.Id})}`;       

        let rowCount = (await context.ExecuteQuery(select)).rowCount;

        let personsAffecteds = await context.Persons.Where({ Field: "Name", Value: "updated 12345"}).ToListAsync();        

        expect(rowCount).toBe(1);

        expect(personsAffecteds.length).toBe(1);

        expect(personsAffecteds[0].Id).toBe(first?.Id);
        
    }, 10000);    


     test("Should increment age of an person", async()=>{
        
        let context = await CompleteSeedAsync();

        let helper =  context.Persons.GetTypeMapping();                    
                
        let person = await context.Persons.OrderBy("Age").FirstOrDefaultAsync();

        let update = `update ${helper.Table} set ${helper.Columns.Age} = ${helper.Columns.Age} - 1 where ${helper.Columns.Id} = ${person?.Id}`;       

        let rowCount = (await context.ExecuteQuery(update)).rowCount;

        let personsUpdated = await context.Persons.Where({ Field: "Id", Value: person?.Id}).FirstOrDefaultAsync();        

        expect(rowCount).toBe(1);

        expect(personsUpdated?.Id).toBe(person?.Id);

        expect(personsUpdated?.Age).toBe(person?.Age! -1);
        
    }, 10000);    

   



});