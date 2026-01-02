import {IStatement, AbstractContext, IJoiningQuery, IJoinSelectable, IDBSet, AbstractSet} from "myorm_core";


import SchemasDecorators from "../core/decorators/SchemasDecorators";
import Type from "../core/design/Type";
import ConstraintFailException from "../core/exceptions/ConstraintFailException";
import InvalidOperationException from "../core/exceptions/InvalidOperationException";
import TypeNotMappedException from "../core/exceptions/TypeNotMappedException";
import PGDBManager from "./PGDBManager";
import PGDBSet from "./PGDBSet";
import PGSetHelper from "./PGSetHelper";
import { DBTypes } from "../Index";
import { IJoining } from "myorm_core/lib/objects/interfaces/IDBContext";
import {DBOperationLogHandler, LogType} from 'myorm_core'; 


export default abstract class PGDBContext extends AbstractContext
{
    protected _manager :PGDBManager;    
    private _inTransactionMode: boolean = false;

    private _mappedTypes! : {new (...args: any[]) : unknown}[];

    constructor(manager : PGDBManager)
    {
        super();
        this._manager = manager;  
    }      
    
    
    public SetLogger(logger: DBOperationLogHandler): void {
        this._manager.SetLogger(logger);
    }
    
    public GetMappedTypes()
    {
        if(this._mappedTypes != undefined)
            return this._mappedTypes;

        this._mappedTypes = [];

        let props = Object.keys(this);

        for(let prop of props)
        {
            if((this as any)[prop].constructor == PGDBSet)
            {
                this._mappedTypes.push((this as any)[prop]["_type"]);
            }
        }

        return this._mappedTypes;
    }

    public IsMapped(type : {new (...args: any[]) : unknown}) : boolean
    {
        return this.GetMappedTypes().filter(t => t == type).length > 0;
    }

    public Collection<T extends Object>(cTor  : {new (...args : any[]) : T}): AbstractSet<T> 
    {

        for(let prop of Object.keys(this))
        {
            let type = (this as any)[prop]["_type"];

            if(type == undefined)
                continue;
            if(type == cTor)
                return (this as any)[prop] as AbstractSet<T>;
        }

        throw new TypeNotMappedException(`${cTor.name} is not mapped in this context`);
    }

    public async UpdateDatabaseAsync(): Promise<void> {
       
        let dbName = this._manager["_connection"].DataBaseName;

        if(!await this._manager.CheckDatabaseAsync(dbName))
            await this._manager.CreateDataBaseAsync(dbName);

        for(let type of this.GetMappedTypes())
        {
            await this._manager.UpdateDatabaseForEntityAsync(type);
        }

    }

    public async ExecuteNonQuery(query : string): Promise<void> {
       await this._manager.ExecuteNonQueryAsync(query);
    }

    public async ExecuteQuery(query : string): Promise<any> {
        return await this._manager.ExecuteAsync(query);
    }    


    public From<T extends Object>(arg: (new (...args: any[]) => T)): IJoiningQuery {
        
        return new JoiningQuery(this, arg);
    }       
    
    
    public async BeginTransactionAsync() : Promise<void>
    {
        await this._manager.BeginTransactionAsync();
        this._inTransactionMode = true;
    }

    public async SavePointAsync(savepoint : string) : Promise<void>
    {
        if(!savepoint || !savepoint.trim())
            throw new InvalidOperationException("The name of savepoint is required");

        if(!this._inTransactionMode)
            throw new InvalidOperationException(`Can not create a savepoint before start a transaction. Call the ${PGDBContext.name}.${this.BeginTransactionAsync.name} method before`);

         await this._manager.SavePointAsync(savepoint);
    }


    public async CommitAsync() : Promise<any>
    {           
        if(!this._inTransactionMode)
            throw new InvalidOperationException(`Can not do a commit before start a transaction. Call the ${PGDBContext.name}.${this.BeginTransactionAsync.name} method before`);

        await this._manager.CommitAsync();
        this._inTransactionMode = false;
    }


    public async RollBackAsync(toSavePoint?: string) : Promise<any>
    {
        if(!this._inTransactionMode)
            throw new InvalidOperationException(`Can not do a rollback before start a transaction. Call the ${PGDBContext.name}.${this.BeginTransactionAsync.name} method before`);

       await this._manager.RollBackAsync(toSavePoint);
        
        if(!toSavePoint)
            this._inTransactionMode = false;
    } 
}

interface IJoinMap{JoiningTable : Function, Type: Join, Left : Function, LeftKey : string, Right : Function, RightKey : string};

export class Joining implements IJoining
{
    private _joiningQuery : JoiningQuery;
    private _joinType : Join;
    private _joining : Function;
    constructor(joiningQuery : JoiningQuery, join : Join, joinig : Function)
    {
        this._joiningQuery = joiningQuery;
        this._joinType = join;
        this._joining = joinig;

    }
    On<T extends Object, U extends Object>(cT: new (...args: any[]) => T, cKey: keyof T, uT: new (...args: any[]) => U, uKey: keyof U): IJoiningQuery {
        
        this._joiningQuery.CheckIfTypeIsAllowed(cT); 
        this._joiningQuery.CheckIfTypeIsAllowed(cT); 
        
        this._joiningQuery.AddOnStatement(
            {
                JoiningTable: this._joining,
                Type: this._joinType,
                Left: cT, 
                LeftKey: cKey.toString(),
                Right: uT, 
                RightKey : uKey.toString()
            });

        return this._joiningQuery as any as IJoiningQuery;
    }
}
export class JoiningQuery implements IJoiningQuery
{

    private _context : PGDBContext;
    private _stack : IUnion[] = [];
    private _onStatements : IJoinMap[] = [];
    

    constructor(context : PGDBContext, arg :  (new (...args: any[]) => Object))
    {
        this._context = context;
        this._stack.push({Type: arg, Join: Join.FROM});
        
        let notMappedTypes = this._stack.filter(s => this._context.Collection(s.Type as new (...args: any[]) => Object ) == undefined);

       
        if(notMappedTypes.length > 0)
        {
            this._stack = [];
            throw new InvalidOperationException(`The type ${(notMappedTypes[0].Type as any).name} is not mapped`);
        }
       
    }

    public InnerJoin(arg: new (...args: any[]) => Object): IJoining {
        this._stack.push({Type: arg, Join: Join.INNER});
        return new Joining(this, Join.INNER, arg);
    }

    public LeftJoin(arg: new (...args: any[]) => Object): IJoining {
        this._stack.push({Type: arg, Join: Join.LEFT});
        return new Joining(this, Join.LEFT, arg);
    }

    public AddOnStatement(on : IJoinMap) : void
    {
        this._onStatements.push(on);
    }

    
    public Where<C extends Object, K extends keyof C>(cT: new (...args: any[]) => C, statement: IStatement<C, K>): IJoiningQuery {
        
        this.CheckIfTypeIsAllowed(cT);
        
        let set = this._context.Collection(cT)!;
        set.Where(statement);

        return this;

    }

    public And<C extends Object, K extends keyof C>(cT: new (...args: any[]) => C, statement: IStatement<C, K>): IJoiningQuery {
        this.CheckIfTypeIsAllowed(cT);
        
        let set = this._context.Collection(cT)!;
        set.And(statement);

        return this;
    }

    public Or<C extends Object, K extends keyof C>(cT: new (...args: any[]) => C, statement: IStatement<C, K>): IJoiningQuery {

        this.CheckIfTypeIsAllowed(cT);
        
        let set = this._context.Collection(cT)!;
        set.Or(statement);

        return this;
    }

    public Select<C extends Object>(cT: new (...args: any[]) => C): IJoinSelectable<C> {

        return new JoinSelectable(cT, this._context, this._stack, this._onStatements);
    }

    public CheckIfTypeIsAllowed(cT: new (...args: any[]) => Object)
    {
        let set = this._context.Collection(cT);

        if(!set)
            throw new InvalidOperationException(`The type ${cT.name} is not mapped`);
        
        let index = this._stack.findIndex(s => s.Type == cT);

        if(index == -1)
            throw new InvalidOperationException(`The type ${cT.name} is not inside the Join list`);
    }
   
}


export class JoinSelectable<T extends Object> implements IJoinSelectable<T>
{
    private _context : PGDBContext;
    private _stack : IUnion[] = [];
    private _onStatements : IJoinMap[] = [];  
    private _type : new (...args: any[]) => T;


    constructor(cT : new (...args: any[]) => T,  context : PGDBContext, stack : IUnion[], onStack : IJoinMap[])
    {
        this._type = cT;
        this._context = context;
        this._stack = stack;
        this._onStatements = onStack;
    }
 
    

    public Take(quantity: number): IJoinSelectable<T> {
        this._context.Collection(this._type)?.Take(quantity);
        return this;
    }


    public Offset(offset: number): IJoinSelectable<T> {
        this._context.Collection(this._type)?.Offset(offset);
        return this;
    }


    public Limit(limit: number): IJoinSelectable<T> {
        this._context.Collection(this._type)?.Limit(limit);
        return this;
    }


    public async CountAsync(): Promise<number> {
        
        let set = this.PrepareQuery();      

        let c = await set.CountAsync();

        this.Reset();
            
        return c;          
    }

    public async ExistsAsync(): Promise<boolean> {
        
        this.Limit(1);
        return (await this.CountAsync()) > 0;
    }
    
   
    public Load<K extends keyof T>(key: K): IJoinSelectable<T> {

       this._context.Collection(this._type)?.Load(key);
       return this;
    }

    public AsUntrackeds(): IJoinSelectable<T> {
       
        this._context.Collection(this._type)?.AsUntrackeds();
        return this;
    }

    public OrderBy<K extends keyof T>(key: K): IJoinSelectable<T> {
        this._context.Collection(this._type)?.OrderBy(key);
        return this;
    }


    public OrderDescendingBy<K extends keyof T>(key: K): IJoinSelectable<T> {
        this._context.Collection(this._type)?.OrderDescendingBy(key);
       return this;
    }


    public async ToListAsync(): Promise<T[]> {
        
        let set = this.PrepareQuery();

        let r = await set.ToListAsync();

        this.Reset();
            
        return r;  
    }

    public async SelectAsync<U extends keyof T>(keys: U[]): Promise<{ [K in U]: T[K]; }[]> {
        
        (this._context.Collection(this._type)! as any)["_selectedsFields"] = keys;
       
        return (await this.AsUntrackeds().ToListAsync()).map(s => {

            let result = {} as { [K in U]: T[K] };

            keys.forEach(key => {
                result[key] = (s as any)[key.toString()];
            });

            return result;        
        });

    }

    protected PrepareQuery(): AbstractSet<T> 
    {

        if(this._stack.length > this._onStatements.length + 1)
            throw new InvalidOperationException(`There is no enought On clausules to join all selected types`);

        if(this._stack.length < this._onStatements.length + 1)
            throw new InvalidOperationException(`There is more On clausules than join types selecteds`);

        let selectedSideSet = this._context.Collection(this._type);       

        let selectedTable = Type.GetTableName(this._type);

        let query = `select distinct ${(selectedSideSet as any)["EvaluateSelect"]()} from "${Type.GetTableName(this._stack[0].Type)}" `;

        for(let i = 0; i < this._onStatements.length; i++)
        {           
            let leftSideType = this._onStatements[i].Left;
            let rightSideType = this._onStatements[i].Right;
            let leftSideTable = Type.GetTableName(leftSideType);
            let rigthSideTable = Type.GetTableName(rightSideType);                        
            let leftSideField = this._onStatements[i].LeftKey;
            let rightSideField = this._onStatements[i].RightKey;
            let leftSideIsArray = Type.GetDesingType(leftSideType, leftSideField) == Array;
            let rightSideIsArray = Type.GetDesingType(rightSideType, rightSideField) == Array;
            let rightSideTypeMap = Type.GetColumnNameAndType(rightSideType);
            let leftSideTypeMap = Type.GetColumnNameAndType(leftSideType);

            query += ` ${this._onStatements[i].Type == Join.LEFT ? 'left' : 'inner'} join "${Type.GetTableName(this._onStatements[i].JoiningTable)}" on `;

            let leftSideRelation = SchemasDecorators.GetRelationAttribute(leftSideType, leftSideField);
            let rightSideRelation = SchemasDecorators.GetRelationAttribute(rightSideType, rightSideField);  

            if((leftSideIsArray && rightSideIsArray) || (!leftSideIsArray && !rightSideIsArray))
            {
                query += ` "${leftSideTable}".${Type.GetColumnName(leftSideType, leftSideField)} = "${rigthSideTable}".${Type.GetColumnName(rightSideType, rightSideField)} `

            }else if (leftSideIsArray && !rightSideIsArray)
            {
                let rightSideDBType : DBTypes;

                if(rightSideRelation)
                {
                    
                    let rType = rightSideRelation.TypeBuilder();
                    let rkey = SchemasDecorators.ExtractPrimaryKey(rType);

                    if(!rkey)
                        throw new ConstraintFailException(`The type ${rType.name} was no one primary key field`);

                    rightSideDBType = Type.CastType(rightSideTypeMap.filter(s => s.Field == rkey)[0].Type);
                }
                else
                {
                    rightSideDBType = Type.CastType(rightSideTypeMap.filter(s => s.Field == rightSideField)[0].Type);
                }       

               if(leftSideRelation)
               {
                    let lType = leftSideRelation.TypeBuilder();
                    let key = SchemasDecorators.ExtractPrimaryKey(lType);

                    if(!key)
                        throw new ConstraintFailException(`The type ${lType.name} was no one primary key field`);
                    
                   let relationMap = Type.GetColumnNameAndType(lType);
                   let leftSideDBType = Type.CastType(relationMap.filter(s => s.Field == key)[0].Type);   
                   let leftColumnName =  leftSideTypeMap.filter(s => s.Field == leftSideField)[0].Column;
                   let rightColumnName =  rightSideTypeMap.filter(s => s.Field == rightSideField)[0].Column;

                   if(leftSideDBType != rightSideDBType)
                   {
                        throw new InvalidOperationException(`${leftSideType.name}.${leftSideField} and ${rightSideType.name}.${rightSideField} must be the same type to join`);
                   }

                   query += ` "${rigthSideTable}".${rightColumnName} = ANY("${leftSideTable}".${leftColumnName})`;


               }
               else
               {
                    let dataType = SchemasDecorators.GetDataTypeAttribute(leftSideType, leftSideField);

                    if(!dataType)
                    {
                        throw new InvalidOperationException(`Can not find the DataAttributeof ${leftSideType.name}.${leftSideField}`);
                    }

                    let elementType = Type.ExtractElementType(dataType);

                    if(!elementType)
                        throw new InvalidOperationException(`Can not determine the array element type of ${leftSideType.name}.${leftSideField}`);
                       
                    let leftColumnName =  leftSideTypeMap.filter(s => s.Field == leftSideField)[0].Column;                                          
                    let rightColumnName =  rightSideTypeMap.filter(s => s.Field == rightSideField)[0].Column;

                    let areNumbers = Type.IsNumber(Type.CastType(elementType)) && Type.IsNumber(rightSideDBType);
                    let areString = Type.IsText(Type.CastType(elementType)) && Type.IsText(rightSideDBType)
                    let areDate = Type.IsDate(Type.CastType(elementType)) && Type.IsDate(rightSideDBType)
                    let areArray = Type.IsArray(Type.CastType(elementType)) && Type.IsArray(rightSideDBType)
                    let areSameType =  this._context["_manager"]["CastToPostgreSQLType"](elementType) == this._context["_manager"]["CastToPostgreSQLType"](rightSideDBType);
                    let areSerial =  this._context["_manager"]["CastToPostgreSQLType"](elementType) == "serial" && this._context["_manager"]["CastToPostgreSQLType"](rightSideDBType) == "serial";
                    

                    if(!(areNumbers || areString || areDate || areArray || areSameType || areSerial))
                        throw new InvalidOperationException(`${leftSideType.name}.${leftSideField} and ${rightSideType.name}.${rightSideField} must be the same type to join`);

                    query += ` "${rigthSideTable}".${rightColumnName} = ANY("${leftSideTable}".${leftColumnName})`;

               }
            }
            else if (rightSideIsArray && !leftSideIsArray)
            {  
                let leftSideDBType : DBTypes;

                if(leftSideRelation)
                {
                    
                    let rType = leftSideRelation.TypeBuilder();
                    let rkey = SchemasDecorators.ExtractPrimaryKey(rType);

                    if(!rkey)
                        throw new ConstraintFailException(`The type ${rType.name} was no one primary key field`);

                    leftSideDBType = Type.CastType(leftSideTypeMap.filter(s => s.Field == rkey)[0].Type);
                }
                else
                {
                    leftSideDBType = Type.CastType(leftSideTypeMap.filter(s => s.Field == leftSideField)[0].Type);
                }   

               if(rightSideRelation)
               {
                    let rType = rightSideRelation.TypeBuilder();
                    let key = SchemasDecorators.ExtractPrimaryKey(rType);

                    if(!key)
                        throw new ConstraintFailException(`The type ${rType.name} was no one primary key field`);
                    
                    let relationMap = Type.GetColumnNameAndType(rType);
                    
                   let rightSideDBType = Type.CastType(relationMap.filter(s => s.Field == key)[0].Type);
                   let leftColumnName =  leftSideTypeMap.filter(s => s.Field == leftSideField)[0].Column;
                   let rightColumnName =  rightSideTypeMap.filter(s => s.Field == rightSideField)[0].Column;
                   
                   if(leftSideDBType != rightSideDBType)
                   {
                        throw new InvalidOperationException(`${leftSideType.name}.${leftSideField} and ${rightSideType.name}.${rightSideField} must be the same type to join`);
                   }

                   query += ` "${leftSideTable}".${leftColumnName} = ANY("${rigthSideTable}".${rightColumnName})`;
               }
               else
               {
                    let dataType = SchemasDecorators.GetDataTypeAttribute(rightSideType, rightSideField);

                    if(!dataType)
                    {
                        throw new InvalidOperationException(`Can not find the DataAttributeof ${rightSideType.name}.${rightSideField}`);
                    }

                    let elementType = Type.ExtractElementType(dataType);

                    if(!elementType)
                        throw new InvalidOperationException(`Can not determine the array element type of ${rightSideType.name}.${rightSideField}`);
                       
                    let leftColumnName =  leftSideTypeMap.filter(s => s.Field == leftSideField)[0].Column;
                    let rightColumnName =  rightSideTypeMap.filter(s => s.Field == rightSideField)[0].Column;

                    let areNumbers = Type.IsNumber(Type.CastType(elementType)) && Type.IsNumber(leftSideDBType);
                    let areString = Type.IsText(Type.CastType(elementType)) && Type.IsText(leftSideDBType)
                    let areDate = Type.IsDate(Type.CastType(elementType)) && Type.IsDate(leftSideDBType)
                    let areArray = Type.IsArray(Type.CastType(elementType)) && Type.IsArray(leftSideDBType)
                    let areSameType =  this._context["_manager"]["CastToPostgreSQLType"](elementType) == this._context["_manager"]["CastToPostgreSQLType"](leftSideDBType);
                    let areSerial =  this._context["_manager"]["CastToPostgreSQLType"](elementType) == "serial" && this._context["_manager"]["CastToPostgreSQLType"](leftSideDBType) == "serial";

                    if(!(areNumbers || areString || areDate || areArray || areSameType || areSerial))
                        throw new InvalidOperationException(`${leftSideType.name}.${leftSideField} and ${rightSideType.name}.${rightSideField} must be the same type to join`);

                        
                    query += ` "${leftSideTable}".${leftColumnName} = ANY("${rigthSideTable}".${rightColumnName})`;             
                }
            }            
        }
        
        let where = "";

        for(let type of this._stack)
        {
            let set = this._context.Collection(type.Type as {new (...args: any[]) : Object})! as PGDBSet<Object>;

            let statements = set["_statements"];

            for(let s of statements)
            {
                let operation = s.StatementType.toString();

                if(operation == "where" && where.length > 0)
                    operation = "and";
                
                where += ` ${operation} ${set["EvaluateStatement"](s)}`;
            }
        }

        PGSetHelper.InjectSQL<T>(selectedSideSet! as PGDBSet<T>, query);
        PGSetHelper.InjectWhere<T>(selectedSideSet! as PGDBSet<T>, where); 

        return selectedSideSet;         
    }

    public async FirstOrDefaultAsync(): Promise<T | undefined> 
    {        
        let set = this.PrepareQuery();
        
        let i = await set.FirstOrDefaultAsync();

        this.Reset();      
        
        return i;
    }

    private Reset() : void
    {
        for(let i = 1; i < this._stack.length; i++)
        {
            let type = this._stack[i].Type as Function;
            let set = this._context.Collection(type as {new (...args: any[]) : Object})! as PGDBSet<Object>;
            set["Reset"]();
        }

        this._stack = [];       
        this._onStatements = [];
    }
    
}


interface IUnion
{
    Type : Function,
    Key?  : string,
    Join : Join
}

enum Join
{
    FROM = 0,
    INNER = 1, 
    LEFT = 2,
} 