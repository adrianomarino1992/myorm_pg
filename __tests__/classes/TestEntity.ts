import { Table, Column, DataType, OneToMany, OneToOne, ManyToMany, DBTypes} from '../../src/Index';
import { Entity } from './Entity';
import { Message } from './RelationEntity';

@Table("person_tb")
export class Person extends Entity
{
    
    @Column()
    public Name : string;

    @Column("email_address")
    public Email : string;

    @Column()    
    public Age : number; 
    

    
    @DataType(DBTypes.INTEGER)
    public CEP : number; 

    
    @OneToOne(()=> Message, "User")
    public Message? : Message;

    
    @DataType(DBTypes.TEXTARRAY)
    public PhoneNumbers : string[];

    
    @DataType(DBTypes.INTEGERARRAY)
    public Documents : number[];

    
    @DataType(DBTypes.DATE)
    public Birth : Date;


    
    @OneToMany(()=> Message, "From")
    public MessagesWriten? : Message[];

    
    @ManyToMany(()=> Message, "To")
    public MessagesReceived? : Message[];

    
    @Column() 
    public LinkTestValueInPerson : number;

    
    @DataType(DBTypes.INTEGERARRAY)
    public LinkTestArrayInPerson : number[];
  
    constructor(name : string = "", email : string = "", age : number = 1)
    {
        super();
        this.Name = name;
        this.Email = email;
        this.Age = age;
        this.CEP = -1;
        this.PhoneNumbers = [];
        this.Birth = new Date(1992,4,23);       
        this.Documents = []; 
        this.MessagesReceived = [];
        this.MessagesWriten = [];
        this.LinkTestValueInPerson = -1;
        this.LinkTestArrayInPerson = [];
        this.Message = undefined;
       
    }
       

}