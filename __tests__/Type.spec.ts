import 'reflect-metadata';
import { Person } from "./classes/TestEntity";
import Type from '../src/core/design/Type';
import RawTypes from "./classes/RawTypes";


describe("Tpe utils functions", ()=>{


    test("should get table name from types", ()=>{
        
        
        let person_tb = Type.GetTableName(Person);
        let rawTypes = Type.GetTableName(RawTypes);

        expect(person_tb).toBe("person_tb");
        expect(rawTypes).toBe("rawtypes");
        
    });


});