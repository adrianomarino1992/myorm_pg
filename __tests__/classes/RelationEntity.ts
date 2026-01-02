import { Table, Column, PrimaryKey, DataType, ManyToOne, ManyToMany, DBTypes, OneToOne} from '../../src/Index';
import { Entity } from './Entity';
import { Person } from './TestEntity';

@Table("message_tb")
export class Message extends Entity
{

    @Column()
    public Message : string;

    
    @ManyToOne(()=> Person, "MessagesWriten")
    public From? : Person;


    
    @OneToOne(()=> Person, "Message")
    public User? : Person;

   
    @ManyToMany(()=> Person, "MessagesReceived")  
    public To? : Person[];     


    @Column() 
    public LinkTestValueInMessage? : number;

   
    @DataType(DBTypes.INTEGERARRAY)
    public LinkTestArrayInMessage? : number[];


    constructor(message : string, from? : Person, to? : Person[])
    {
        super();
        this.Message = message;
        this.From = from;
        this.To = to;       
        this.LinkTestValueInMessage = -1;
        this.LinkTestArrayInMessage = [];        
    }
       

}