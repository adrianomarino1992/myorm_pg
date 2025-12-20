import PGDBConnection from "../../src/implementations/PGDBConnection";
import Context from "../classes/TestContext";
import PGDBManager from "../../src/implementations/PGDBManager";
import { Person } from "../classes/TestEntity";
import Type from "../../src/core/design/Type";
import { Message } from "../classes/RelationEntity";

export function Try(action: () => void, onError?: (e: Error) => void) {
  try {
    action();
  } catch (ex) {
    if (onError) onError(ex as Error);
  }
}

export async function TryAsync(
  action: () => Promise<void>,
  onError?: (e: Error) => void
) {
  try {
    await action();
  } catch (ex) {
    if (onError) onError(ex as Error);
  }
}

export function CreateConnection() {
  return new PGDBConnection("localhost", 5432, "db", "user", "password");
}

export function CreateContext(): Context {
  const context = new Context(new PGDBManager(CreateConnection()));
  context.SetLogger((message, type) => {

    console.debug(type, message)
  });

  return context;
}


export async function SeedAsync(): Promise<Context> {
  await TruncateTablesAsync();

  let context = CreateContext();


  let adriano = new Person("Adriano", "adriano@test.com");
  adriano.Birth = new Date(1992, 4, 23);
  adriano.Documents = [123, 4, 5, 678, 9];
  adriano.PhoneNumbers = ['+55(12)98206-8255'];
  await context.Persons.AddAsync(adriano);
  let camila = new Person("Camila", "camila@test.com");
  camila.Documents = [];
  await context.Persons.AddAsync(camila);
  await context.Persons.AddAsync(new Person("Juliana", "juliana@test.com"));
  await context.Persons.AddAsync(new Person("Andre", "andre@test.com"));
  return context;
}

export async function CompleteSeedAsync(): Promise<Context> {

  let context = CreateContext();

  await TruncateTablesAsync();

  let adriano = new Person("adriano", "adriano@test.com");
  adriano.Birth = new Date(1992, 4, 23);
  adriano.Documents = [1234432, 443224, 4324322, 32142132, 432432545];
  adriano.LinkTestValueInPerson = 1;
  adriano.LinkTestArrayInPerson = [1, 2, 3, 4, 5];
  await context.Persons.AddAsync(adriano);

  let camila = new Person("camila", "camila@test.com");
  camila.Birth = new Date(1992, 6, 21);
  camila.Documents = [5435436, 76576523, 43256778];
  camila.LinkTestValueInPerson = 2;
  camila.LinkTestArrayInPerson = [1, 2, 3, 4, 5];
  await context.Persons.AddAsync(camila);

  let juliana = new Person("juliana", "juliana@test.com");
  juliana.Birth = new Date(1993, 4, 30);
  juliana.Documents = [1232323, 42321, 51211, 321321, 932432];
  juliana.LinkTestValueInPerson = 3;
  juliana.LinkTestArrayInPerson = [2, 3, 4];
  await context.Persons.AddAsync(juliana);

  let andre = new Person("andre", "andre@test.com");
  andre.Birth = new Date(1995, 4, 18);
  andre.Documents = [4324543, 5543543, 543543543, 954351];
  andre.LinkTestValueInPerson = 4;
  andre.LinkTestArrayInPerson = [1, 2, 3];
  await context.Persons.AddAsync(andre);


  let msg = new Message('Some message from Adriano', adriano, [camila, juliana, andre]);
  msg.LinkTestValueInMessage = 1;
  msg.LinkTestArrayInMessage = [1, 2, 3, 4, 5];
  await context.Messages.AddAsync(msg);

  msg = new Message('Some private message from Adriano', adriano, [camila]);
  msg.LinkTestValueInMessage = 2;
  msg.LinkTestArrayInMessage = [1];
  await context.Messages.AddAsync(msg);

  msg = new Message('Some message from Camila', camila, [adriano, juliana, andre]);
  msg.LinkTestValueInMessage = undefined;
  msg.LinkTestArrayInMessage = [1, 2, 3, 4, 5, 5, 6, 7];
  await context.Messages.AddAsync(msg);

  msg = new Message('Some message from Adriano to nobody', adriano, []);
  msg.LinkTestValueInMessage = 7;
  msg.LinkTestArrayInMessage = undefined;
  await context.Messages.AddAsync(msg);

  return context;
}


export async function LeftJoinSeedAsync(): Promise<Context> {

  let context = CreateContext();

  await TruncateTablesAsync();

  let adriano = new Person("adriano", "adriano@test.com");
  adriano.Birth = new Date(1992, 4, 23);
  adriano.Documents = [1234432, 443224, 4324322, 32142132, 432432545];
  adriano.LinkTestValueInPerson = 1;
  adriano.LinkTestArrayInPerson = [1, 2, 3, 4, 5];
  await context.Persons.AddAsync(adriano);

  let camila = new Person("camila", "camila@test.com");
  camila.Birth = new Date(1992, 6, 21);
  camila.Documents = [5435436, 76576523, 43256778];
  camila.LinkTestValueInPerson = 2;
  camila.LinkTestArrayInPerson = [1, 2, 3, 4, 5];
  await context.Persons.AddAsync(camila);

  let juliana = new Person("juliana", "juliana@test.com");
  juliana.Birth = new Date(1993, 4, 30);
  juliana.Documents = [1232323, 42321, 51211, 321321, 932432];
  juliana.LinkTestValueInPerson = 3;
  juliana.LinkTestArrayInPerson = [2, 3, 4];
  await context.Persons.AddAsync(juliana);

  let andre = new Person("andre", "andre@test.com");
  andre.Birth = new Date(1995, 4, 18);
  andre.Documents = [4324543, 5543543, 543543543, 954351];
  andre.LinkTestValueInPerson = 4;
  andre.LinkTestArrayInPerson = [1, 2, 3];
  await context.Persons.AddAsync(andre);

   let ana = new Person("ana", "ana@test.com");
  ana.Birth = new Date(1992, 4, 29);
  ana.Documents = [123134432, 42343224, 432454322, 287899, 66543223];
  ana.LinkTestValueInPerson = 1;
  ana.LinkTestArrayInPerson = [1, 2, 3, 4, 5];
  await context.Persons.AddAsync(ana);



  let msg = new Message('Some message from Adriano', adriano, [camila, juliana, andre]);
  msg.LinkTestValueInMessage = 1;
  msg.LinkTestArrayInMessage = [1, 2, 3, 4, 5];
  await context.Messages.AddAsync(msg);

  msg = new Message('Some private message from Adriano', adriano, [camila]);
  msg.LinkTestValueInMessage = 2;
  msg.LinkTestArrayInMessage = [1];
  await context.Messages.AddAsync(msg);

  msg = new Message('Some message from Camila', camila, [adriano, juliana, andre]);
  msg.LinkTestValueInMessage = undefined;
  msg.LinkTestArrayInMessage = [1, 2, 3, 4, 5, 5, 6, 7];
  await context.Messages.AddAsync(msg);

  msg = new Message('Some message from Adriano to nobody', adriano, []);
  msg.LinkTestValueInMessage = 7;
  msg.LinkTestArrayInMessage = undefined;
  await context.Messages.AddAsync(msg);

  msg = new Message('Some message from no one to nobody', undefined, []);
  msg.LinkTestValueInMessage = 7;
  msg.LinkTestArrayInMessage = undefined;
  await context.Messages.AddAsync(msg);

  msg = new Message('Some message from no one to Adriano', undefined, [adriano]);
  msg.LinkTestValueInMessage = 7;
  msg.LinkTestArrayInMessage = undefined;
  await context.Messages.AddAsync(msg);

  return context;
}

export async function TruncatePersonTableAsync() {
  let conn = CreateConnection();
  await conn.OpenAsync();
  try {
    await conn.ExecuteNonQueryAsync(`truncate table ${Type.GetTableName(Person)}`);
  } finally {
    await conn.CloseAsync();
  }
}

export async function TruncateTablesAsync() {
  let conn = CreateConnection();
  await conn.OpenAsync();
  try {
    await conn.ExecuteNonQueryAsync(`truncate table ${Type.GetTableName(Person)}`);
    await conn.ExecuteNonQueryAsync(`truncate table ${Type.GetTableName(Message)}`);
  } finally {
    await conn.CloseAsync();
  }

}



