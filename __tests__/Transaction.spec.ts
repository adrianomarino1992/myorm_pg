import 'reflect-metadata';
import { Person } from './classes/TestEntity';
import { Operation } from 'myorm_core';
import {TruncatePersonTableAsync, CreateContext, SeedAsync, CompleteSeedAsync, TruncateTablesAsync} from './functions/TestFunctions';
import TypeNotMappedException from '../src/core/exceptions/TypeNotMappedException';
import { Message } from './classes/RelationEntity';




describe("Transactions", () => {

    test("Should save all entities", async () => {

         await TruncateTablesAsync();
         const context = CreateContext();

         const person1 = new Person("Adriano", "adriano@test.com");
         const person2 = new Person("Camila", "camila@test.com");
         const person3 = new Person("Juliana", "juliana@test.com");
         const person4 = new Person("Andre", "andre@test.com");
        
         const msg = new Message("some message", person1, [person2, person3, person4]);


         await context.BeginTransactionAsync();

         await context.Persons.AddAsync(person1);
         await context.Persons.AddAsync(person2);
         await context.Persons.AddAsync(person3);
         await context.Persons.AddAsync(person4);
         await context.Messages.AddAsync(msg);

         await context.CommitAsync();


        let personsCount = await context.Persons.CountAsync();
        let mgsCount = await context.Messages.CountAsync();


        expect(personsCount).toBe(4);
        expect(mgsCount).toBe(1);

    }, 100000 );


    test("Should save all persons only", async () => {

         await TruncateTablesAsync();
         const context = CreateContext();

         const person1 = new Person("Adriano", "adriano@test.com");
         const person2 = new Person("Camila", "camila@test.com");
         const person3 = new Person("Juliana", "juliana@test.com");
         const person4 = new Person("Andre", "andre@test.com");
        
         const msg = new Message("some message", person1, [person2, person3, person4]);


         await context.BeginTransactionAsync();

         await context.Persons.AddAsync(person1);
         await context.Persons.AddAsync(person2);
         await context.Persons.AddAsync(person3);
         await context.Persons.AddAsync(person4);

         await context.SavePointAsync("persons");

         await context.Messages.AddAsync(msg);

         await context.RollBackAsync("persons");

         await context.CommitAsync();


        let personsCount = await context.Persons.CountAsync();
        let mgsCount = await context.Messages.CountAsync();


        expect(personsCount).toBe(4);
        expect(mgsCount).toBe(0);

    }, 100000 );
    

    test("Should rollback all transaction", async () => {

         await TruncateTablesAsync();
         const context = CreateContext();

         const person1 = new Person("Adriano", "adriano@test.com");
         const person2 = new Person("Camila", "camila@test.com");
         const person3 = new Person("Juliana", "juliana@test.com");
         const person4 = new Person("Andre", "andre@test.com");
        
         const msg = new Message("some message", person1, [person2, person3, person4]);


         await context.BeginTransactionAsync();

         await context.Persons.AddAsync(person1);
         await context.Persons.AddAsync(person2);
         await context.Persons.AddAsync(person3);
         await context.Persons.AddAsync(person4);

         await context.SavePointAsync("persons");

         await context.Messages.AddAsync(msg);

         await context.RollBackAsync("persons");

         await context.RollBackAsync();


        let personsCount = await context.Persons.CountAsync();
        let mgsCount = await context.Messages.CountAsync();


        expect(personsCount).toBe(0);
        expect(mgsCount).toBe(0);

    }, 100000 );


});5