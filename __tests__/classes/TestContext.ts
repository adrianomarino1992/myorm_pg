import { PGDBManager, PGDBContext, PGDBSet} from '../../src/Index';
import { Message } from './RelationEntity';
import { Person } from './TestEntity';
import EntityWithNoKey from  './EntityWithNoKey';


export default class Context extends PGDBContext
{
    public Persons : PGDBSet<Person>;
    public Messages : PGDBSet<Message>;
    public ErrorEntity? : PGDBSet<EntityWithNoKey>

    constructor(manager : PGDBManager)
    {
        super(manager);  
        this.Persons = new PGDBSet(Person, this);      
        this.Messages = new PGDBSet(Message, this);      
    }
}


