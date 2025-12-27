import { Person } from './classes/TestEntity';
import { Operation } from 'myorm_core';
import { CompleteSeedAsync } from './functions/TestFunctions';
import { Message } from './classes/RelationEntity';

describe('Context query and join operations', () => {

    test('Inner join where the right side is an array related to the left side', async () => {

        let context = await CompleteSeedAsync();

        let msgs = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'Id', Message, 'To')
            .Where(Person, {
                Field: 'Name',
                Kind: Operation.CONTAINS,
                Value: 'camila'
            })
            .Select(Message)
            .Load('To')
            .ToListAsync();

        expect(msgs.length).toBe(2);
        expect(msgs.findIndex(s => s.To?.length === 3)).toBeGreaterThan(-1);
        expect(msgs.findIndex(s => s.To?.length === 1)).toBeGreaterThan(-1);

    }, 5 ^ 100000);

    test('Query using array containment with the conventional query syntax', async () => {

        let context = await CompleteSeedAsync();

        let camila = await context.Persons
            .Where({ Field: 'Name', Value: 'camila' })
            .FirstOrDefaultAsync();

        let msgs = await context.Messages
            .Where({
                Field: 'To',
                Kind: Operation.CONTAINS,
                Value: [camila!]
            })
            .Load('To')
            .ToListAsync();

        expect(msgs.length).toBe(2);
        expect(msgs.findIndex(s => s.To?.length === 3)).toBeGreaterThan(-1);
        expect(msgs.findIndex(s => s.To?.length === 1)).toBeGreaterThan(-1);

    }, 5 ^ 100000);

    test('Query using direct object reference with the conventional syntax', async () => {

        let context = await CompleteSeedAsync();

        let adriano = await context.Persons
            .Where({ Field: 'Name', Value: 'adriano' })
            .FirstOrDefaultAsync();

        let msgs = await context.Messages
            .Where({
                Field: 'From',
                Value: adriano!
            })
            .Load('From')
            .ToListAsync();

        expect(msgs.length).toBe(3);
        expect(msgs[0].From?.Name).toBe('adriano');
        expect(msgs[1].From?.Name).toBe('adriano');
        expect(msgs[2].From?.Name).toBe('adriano');

    }, 5 ^ 100000);

    test('Inner join where the right side is an array and the left side has a related scalar field', async () => {

        let context = await CompleteSeedAsync();

        let msgs = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'Id', Message, 'To')
            .Where(Person, {
                Field: 'Name',
                Kind: Operation.CONTAINS,
                Value: 'camila'
            })
            .Where(Message, {
                Field: 'Message',
                Kind: Operation.CONTAINS,
                Value: 'private'
            })
            .Select(Message)
            .Load('To')
            .ToListAsync();

        expect(msgs.length).toBe(1);
        expect(msgs[0].To?.length).toBe(1);
        expect(msgs[0].To?.[0].Name).toBe('camila');

    }, 5 ^ 100000);

    test('Inner join where the left side is an array and the right side is a scalar field', async () => {

        let context = await CompleteSeedAsync();

        let msgs = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'MessagesReceived', Message, 'Id')
            .Where(Person, {
                Field: 'Name',
                Kind: Operation.CONTAINS,
                Value: 'camila'
            })
            .Select(Message)
            .Load('To')
            .ToListAsync();

        expect(msgs.length).toBe(2);
        expect(msgs.findIndex(s => s.To?.length === 3)).toBeGreaterThan(-1);
        expect(msgs.findIndex(s => s.To?.length === 1)).toBeGreaterThan(-1);

    }, 5 ^ 100000);

    test('Inner join using unrelated scalar fields on both sides', async () => {

        let context = await CompleteSeedAsync();

        let msgs = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'LinkTestValueInPerson', Message, 'LinkTestValueInMessage')
            .Where(Person, {
                Field: 'Name',
                Value: 'adriano'
            })
            .Select(Message)
            .Load('From')
            .Load('To')
            .ToListAsync();

        expect(msgs.length).toBe(1);
        expect(msgs[0].From?.Name).toBe('adriano');
        expect(msgs[0].To?.length).toBe(3);

    }, 5 ^ 100000);

    test('Inner join where the left side is an array with no direct relation to the right side', async () => {

        let context = await CompleteSeedAsync();

        let msgs = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'LinkTestArrayInPerson', Message, 'LinkTestValueInMessage')
            .Where(Person, {
                Field: 'Name',
                Value: 'adriano'
            })
            .Select(Message)
            .Load('From')
            .Load('To')
            .ToListAsync();

        expect(msgs.length).toBe(2);
        expect(msgs[0].From?.Name).toBe('adriano');
        expect(msgs[1].From?.Name).toBe('adriano');
        expect(msgs.findIndex(s => s.To?.length === 3)).toBeGreaterThan(-1);
        expect(msgs.findIndex(s => s.To?.length === 1)).toBeGreaterThan(-1);

    }, 5 ^ 100000);

    test('Inner join where the right side is an array with no direct relation to the left side', async () => {

        let context = await CompleteSeedAsync();

        let msgs = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'LinkTestValueInPerson', Message, 'LinkTestArrayInMessage')
            .Select(Message)
            .Load('From')
            .Load('To')
            .ToListAsync();

        expect(msgs.length).toBe(3);

    }, 100000);

    test('Ordering results in descending order', async () => {

        let context = await CompleteSeedAsync();

        let msgsFromAdriano = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'MessagesWriten', Message, 'Id')
            .Where(Person, { Field: 'Name', Value: 'adriano' })
            .Select(Message)
            .OrderDescendingBy('Message')
            .ToListAsync();

        expect(msgsFromAdriano.length).toBe(3);
        expect(msgsFromAdriano[0].Message).toBe('Some private message from Adriano');
        expect(msgsFromAdriano[1].Message).toBe('Some message from Adriano to nobody');
        expect(msgsFromAdriano[2].Message).toBe('Some message from Adriano');

    }, 100000);

    test('Limiting the number of returned records using take', async () => {

        let context = await CompleteSeedAsync();

        let msgsFromAdriano = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'MessagesWriten', Message, 'Id')
            .Where(Person, { Field: 'Name', Value: 'adriano' })
            .Select(Message)
            .OrderDescendingBy('Message')
            .Take(1)
            .ToListAsync();

        expect(msgsFromAdriano.length).toBe(1);
        expect(msgsFromAdriano[0].Message).toBe('Some private message from Adriano');

    }, 100000);

    test('Limiting the number of returned records using limit', async () => {

        let context = await CompleteSeedAsync();

        let msgsFromAdriano = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'MessagesWriten', Message, 'Id')
            .Where(Person, { Field: 'Name', Value: 'adriano' })
            .Select(Message)
            .OrderDescendingBy('Message')
            .Limit(2)
            .ToListAsync();

        expect(msgsFromAdriano.length).toBe(2);
        expect(msgsFromAdriano[0].Message).toBe('Some private message from Adriano');
        expect(msgsFromAdriano[1].Message).toBe('Some message from Adriano to nobody');

    }, 100000);

    test('Skipping records using offset', async () => {

        let context = await CompleteSeedAsync();

        let msgsFromAdriano = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'MessagesWriten', Message, 'Id')
            .Where(Person, { Field: 'Name', Value: 'adriano' })
            .Select(Message)
            .OrderDescendingBy('Message')
            .Limit(1000)
            .Offset(1)
            .ToListAsync();

        expect(msgsFromAdriano.length).toBe(2);
        expect(msgsFromAdriano[0].Message).toBe('Some message from Adriano to nobody');
        expect(msgsFromAdriano[1].Message).toBe('Some message from Adriano');

    }, 100000);

    test('Counting records after applying filters and joins', async () => {

        let context = await CompleteSeedAsync();

        let count = await context.From(Person)
            .InnerJoin(Message)
            .On(Person, 'MessagesWriten', Message, 'Id')
            .Where(Person, { Field: 'Name', Value: 'adriano' })
            .Select(Message)
            .OrderDescendingBy('Message')
            .CountAsync();

        expect(count).toBe(3);

    }, 100000);

});
