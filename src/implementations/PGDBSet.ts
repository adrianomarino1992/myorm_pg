import {IStatement, Operation, IDBSet, IFluentField, AbstractSet} from "myorm_core";


import Type from "../core/design/Type";
import { DBTypes } from "../core/enums/DBTypes";
import SchemasDecorators from "../core/decorators/SchemasDecorators";
import PGDBManager from "./PGDBManager";
import NotImpletedException from "../core/exceptions/NotImplementedException";
import TypeNotSuportedException from "../core/exceptions/TypeNotSuportedException";
import PGDBContext from "./PGDBContext";
import InvalidOperationException from "../core/exceptions/InvalidOperationException";
import { RelationType } from "../core/enums/RelationType";
import ConstraintFailException from "../core/exceptions/ConstraintFailException";
import PGFluentField from "./PGFluentField";
import PGSetHelper from "./PGSetHelper";
import ColumnNotExistsException from "../core/exceptions/ColumnNotExistsException";



export default class PGDBSet<T extends Object>  extends AbstractSet<T>
{   
    private _type! : {new (...args : any[]) : T};    
    private _table! : string;
    private _maps! : ReturnType<typeof Type.GetColumnNameAndType>;
    private _manager! : PGDBManager;
    private _context! : PGDBContext;
    private _statements : IPGStatement[] = [];
    private _ordering : IPGOrdenation<T>[] = [];
    private _includes: IPGIncluding<T>[] = []
    private _limit? : IPGLimiter;
    private _offset? : IPGOffset;
    private _set : PGSetValue<T>;
    private _whereAsString? : string;
    private _untrackeds : boolean;
    private _selectedsFields : string[] = [];

    constructor(cTor : { new(...args : any[]) : T}, context : PGDBContext)
    {
        super();
        this._type = cTor;
        this._table = Type.GetTableName(cTor);
        this._maps = Type.GetColumnNameAndType(cTor);
        this._manager = context["_manager"];
        this._context = context;
        this._set = new PGSetValue<T>();
        this._untrackeds = false;

    }
       

    public async AddObjectAndRelationsAsync(obj: T, relations: (keyof T)[]): Promise<T> {
        return this.AddObjectAsync(obj, false, relations);
    }
    
    public AddAsync(obj : T): Promise<T> {
        return this.AddObjectAsync(obj);
    }

    protected AddObjectAsync(obj : T, cascade : boolean = true, relations : (keyof T)[] = [], visiteds : any[] = []): Promise<T> {

        return this.CreatePromisse(async () => 
        {
            visiteds = visiteds ?? [];
            if(!obj)
                throw new InvalidOperationException(`Cannot insert a null reference object of ${this._type.name}`);

            if(!this.IsCorrectType(obj))
                throw new InvalidOperationException(`The object passed as argument is not a ${this._type.name} instance`);

            let sql = `insert into "${this._table}"(`;
            let values = `values (`;
            let returnKey = '';       
            let key : {Property : string, Column : string} | undefined;
            let subTypes : typeof this._maps = [];  

            for(let map of this._maps)
            {
                    if(SchemasDecorators.IsPrimaryKey(this._type, map.Field))
                    {
                        returnKey = `returning ${map.Column}`;
                        key = 
                        {
                            Column : map.Column, 
                            Property : map.Field
                        }
                        continue;
                    }

                    let currPropValue = Reflect.get(obj, map.Field);

                   
                    let relation = SchemasDecorators.GetRelationAttribute(this._type, map.Field);
                    let designType = Type.GetDesingType(this._type, map.Field);

                    let isArray = designType == Array;
                    
                    if(isArray && relation)
                        designType = relation?.TypeBuilder();                                  

                    if(!designType && relation)
                        designType = relation.TypeBuilder();
                     

                    if((designType && this._context.IsMapped(designType)))
                    {
                        if(currPropValue == undefined || currPropValue == null)
                        {
                            let subPK = SchemasDecorators.ExtractPrimaryKey(designType!);
    
                            let columnType = Type.CastType(Type.GetDesingTimeTypeName(designType!, subPK!)!);
                            
                            Type.InjectMetadata(
                                obj, 
                                {
                                    Field: map.Field, 
                                    Type: columnType as DBTypes,
                                    Value : undefined, 
                                    Loaded : true                                
                                }
                            );
    
                            continue;
                        }   

                        subTypes.push({
                            Column : map.Column, 
                            Field : map.Field, 
                            Type : map.Type
                        });
                        
                        continue;
                    }
                    

                    let colType = Type.CastType(map.Type);

                    sql += `"${map.Column}",`;            
                    
                    if(currPropValue == undefined || currPropValue == null)
                        values += `null,`;  
                    else   
                        values += `${this.CreateValueStatement(colType, Reflect.get(obj, map.Field))},`;
                    
            }

            if(key == undefined)            
                throw new InvalidOperationException(`The type ${this._type.name} must have a primary key field`);

            if(visiteds.filter(s => s && s.constructor == obj.constructor && Reflect.get(s, key!.Property) == Reflect.get(obj, key!.Property)).length > 0)
                return obj;
            visiteds.push(obj);
            
            if(Type.HasValue(Reflect.get(obj as any, key.Property)))            
                throw new InvalidOperationException(`Can not add a ${this._type.name} with ${key.Property} provided`);
            
            
            sql = sql.substring(0, sql.length - 1) + ") ";
            values = values.substring(0, values.length - 1) + ")";

            let insert = `${sql} ${values} ${returnKey};`;
            
            let retun = await this._manager.ExecuteAsync(insert);
            

            if(key != undefined && retun.rows.length > 0)
            {
                (obj as any)[key.Property] = retun.rows[0][key.Column];
            }

            
            let subTypesUpdates : string[] = [];
            let updatableFields : string[] = [];
            let objectsToUpdate : {Objs : { Obj : any, UpdatableFields : string[]}[], Type : {new (...args: any[]) : unknown}, SubPK : string}[] = [];
            let objectsToAdd : {Objs : any[], Type : {new (...args: any[]) : unknown}, SubPK : string}[] = []; 
            let buildSubupdates : (() => void)[] = [];
            for(let sub of subTypes)
            {
                let relation = SchemasDecorators.GetRelationAttribute(this._type, sub.Field);
                let subType = Type.GetDesingType(this._type, sub.Field)!;

                if(!subType && !relation)
                    throw new InvalidOperationException(`Can not determine the relation of the property ${this._type}.${sub.Field}`);

                if(!subType && relation)
                {   
                    subType = relation.TypeBuilder();
                }

                let isArray = subType == Array;
                if(isArray)
                {
                    if(!relation)
                        continue;
                    
                    subType = relation?.TypeBuilder();
                }

                let subObj = Reflect.get(obj, sub.Field);

                let subPK = SchemasDecorators.ExtractPrimaryKey(subType);

                if(subObj == undefined)
                    continue;             
                
                if(subPK == undefined)                
                    throw new InvalidOperationException(`The type ${subType.name} must have a primary key column`);  


                let colletion = this._context.Collection(subType as {new (...args: any[]) : Object})!;

                if(key != undefined){
                    for(let subKey of Type.GetProperties(subType))
                    {
                        let subRelation = SchemasDecorators.GetRelationAttribute(subType, subKey);
                        
                        if(subRelation && subRelation.TypeBuilder() == this._type){

                            if(subRelation.Field != undefined && subRelation.Field != sub.Field)
                                continue;
                           
                            updatableFields.push(subKey);

                            if(subRelation.Relation == RelationType.ONE_TO_MANY || subRelation.Relation == RelationType.MANY_TO_MANY)
                            {                              

                                if(isArray)
                                {
                                    if(subObj == undefined || visiteds.indexOf(subObj) > -1)
                                        continue;

                                    for(let i of subObj as Array<typeof subType>)
                                    {
                                        if(i == undefined || visiteds.indexOf(i) > -1)
                                            continue;

                                        let metadata = Type.ExtractMetadata(i).filter(s => s.Field == subKey && s.Loaded);

                                        let value : any[] = []; 

                                        if(metadata.length > 0)
                                        {
                                            value = ((Reflect.get(i, subKey) ?? []) as Array<typeof subType>).filter(s => (s as any)[subPK!] != (obj as any)[subPK!]);  
                                        }else
                                        {
                                            let item = await (colletion as any)["Where"]({Field : subPK, Value : Reflect.get(i, subPK)})["LoadRelationOn"](subKey)["FirstOrDefaultAsync"]();
                                            value = item == undefined ? [] : item![subKey] as any[];
                                            value = value ?? [];
                                        }

                                        value.push(obj);

                                        Reflect.set(i as any, subKey, value);
                                    }
                                }else{

                                    if(subObj == undefined || visiteds.indexOf(subObj) > -1)
                                        continue;

                                    let metadata = Type.ExtractMetadata(subObj).filter(s => s.Field == subKey && s.Loaded);

                                    let value : any[] = []; 

                                    if(metadata.length > 0)
                                    {
                                        value = ((Reflect.get(subObj, subKey) ?? []) as Array<typeof this._type>).filter(s => (s as any)[subPK!] != (obj as any)[subPK!]);    
                                    }else
                                    {
                                        let item = await (colletion as any)["Where"]({Field : subPK, Value : Reflect.get(subObj, subPK)})["LoadRelationOn"](subKey)["FirstOrDefaultAsync"]();

                                        value = item == undefined ? [] : item![subKey] as any[];

                                        value = value ?? [];
                                    }

                                    value.push(obj);                                                                   
                                    
                                    Reflect.set(subObj, subKey, value);
                                }
                               
                            }else{

                                if(subRelation.Relation == RelationType.MANY_TO_ONE && isArray)
                                {
                                    for(let i of subObj as Array<typeof subType>)
                                    {  
                                        if(i == undefined || visiteds.indexOf(i) > -1)
                                            continue;

                                        Reflect.set(i as any, subKey, obj);
                                    }
                                }else{

                                    if(subObj == undefined || visiteds.indexOf(subObj) > -1)
                                        continue;

                                    Reflect.set(subObj as any, subKey, obj);
                                }
                            }

                                                      

                        }
                    }
                }              
               
                if(isArray)
                {
                    if(subObj == undefined)
                        continue;

                    for(let i of subObj as Array<typeof subType>)
                    {
                        if(i == undefined)
                            continue;

                        if(!Type.HasValue(Reflect.get(i as any, subPK))){
                            if(cascade || relations.filter(s => s == sub.Field).length > 0)
                                {
                                    let cs = objectsToAdd.filter(s => s.Type == subType);

                                    if(cs.length == 0)
                                        objectsToAdd.push({Objs : [i], Type : subType, SubPK : subPK});
                                    else
                                        cs[0].Objs.push(i);

                                }
                        }
                        else 
                        {
                            let cs = objectsToUpdate.filter(s => s.Type == subType);
    
                            if(cs.length == 0)
                                objectsToUpdate.push({Objs : [{Obj : i,  UpdatableFields : updatableFields}] , Type : subType, SubPK : subPK});
                            else{

                                let ccs = cs.filter(s => s.Objs.filter(j => j.Obj == i).length > 0);

                                if(ccs.length == 0)
                                {
                                    cs[0].Objs.push({Obj : i,  UpdatableFields : updatableFields});

                                }else{        

                                    ccs[0].Objs[0].UpdatableFields.push(...updatableFields);
                                }
                            }
    
                        }
                    }
                }else{

                    if(subObj == undefined)
                        continue;

                    if(!Type.HasValue(Reflect.get(subObj as any, subPK))){
                        if(cascade || relations.filter(s => s == sub.Field).length > 0)
                        {
                            let cs = objectsToAdd.filter(s => s.Type == subType);

                            if(cs.length == 0)
                                objectsToAdd.push({Objs : [subObj], Type : subType, SubPK : subPK});
                            else
                                cs[0].Objs.push(subObj);

                        }
                    }
                    else 
                    {
                        let cs = objectsToUpdate.filter(s => s.Type == subType);
    
                            if(cs.length == 0)
                                objectsToUpdate.push({Objs : [{Obj : subObj,  UpdatableFields : updatableFields}] , Type : subType, SubPK : subPK});
                            else{

                                let ccs = cs.filter(s => s.Objs.filter(j => j.Obj == subObj).length > 0);

                                if(ccs.length == 0)
                                {
                                    cs[0].Objs.push({Obj : subObj,  UpdatableFields : updatableFields});

                                }else{        
                                                                
                                    ccs[0].Objs[0].UpdatableFields.push(...updatableFields);
                                }
                            }

                    }
                }  

                
                buildSubupdates.push(() =>
                {
                    let spk = SchemasDecorators.ExtractPrimaryKey(subType)!;

                    let columnType = Type.CastType(Type.GetDesingTimeTypeName(subType, spk)!);

                    if(relation?.Relation == RelationType.MANY_TO_MANY || relation?.Relation == RelationType.ONE_TO_MANY || isArray)
                        columnType = Type.AsArray(columnType) as DBTypes;
                    
                    if(subObj == undefined)
                        return;
                    
                    let updateValues = [Reflect.get(subObj as any, spk)];
    
                    if(isArray)
                    {
                        updateValues = [];
    
                        for(let i of subObj as Array<typeof subType>)
                        {
                            if(i == undefined)
                                continue;
    
                            updateValues.push(Reflect.get(i as any, spk));
                        }
                    }

                    Type.InjectMetadata(
                        obj, 
                        {
                            Field: sub.Field, 
                            Type: columnType as DBTypes,
                            Value : updateValues, 
                            Loaded : true                                
                        }
                    );
    
                    subTypesUpdates.push(`"${sub.Column}" = ${this.CreateValueStatement(columnType, isArray ? updateValues : updateValues[0])}`);
                });

                
                               
            }
            
            objectsToAdd.forEach(o => 
            {
                o.Objs =  o.Objs .filter((i, ix, s) => 
                {
                    return ix == s.findIndex(v => v == i);
                });
            });            
                     

            for(let cs of objectsToAdd)
            {
                let colletion = this._context.Collection(cs.Type as {new (...args: any[]) : Object})!;

                for(let i of cs.Objs)
                    await (colletion as PGDBSet<typeof cs.Type>)["AddObjectAsync"](i as any, true, [], visiteds);
            }

            for(let cs of objectsToUpdate)
            {
                let colletion = this._context.Collection(cs.Type as {new (...args: any[]) : Object})!;

                for(let i of cs.Objs)
                    await (colletion as PGDBSet<typeof cs.Type>)["UpdateObjectAsync"](i.Obj as any, false, i.UpdatableFields ?? [], [], visiteds);
            }

            for(let b of buildSubupdates)
                b();  

            if(subTypesUpdates.length > 0)
            {
                let subUpdate = `update "${Type.GetTableName(this._type)}" set `;

                for(let p of subTypesUpdates)
                {
                    subUpdate += `${p},`;
                }

                subUpdate = `${subUpdate.substring(0, subUpdate.length - 1)} where `;               
                
                subUpdate += this.EvaluateStatement({
                    StatementType : StatementType.WHERE, 
                    Statement : 
                    {
                        Field : key!.Property,
                        Kind : Operation.EQUALS, 
                        Value : Reflect.get(obj, key!.Property)
                    }
                });

                await this._manager.ExecuteNonQueryAsync(subUpdate);
            }

            return obj;

        });              
    }

    UpdateSelectionAsync(): Promise<void> {
        
        return this.CreatePromisse(async() => 
        {
            if(!this._set || this._set.Get().length == 0)
                throw new InvalidOperationException('Can not realize a update with no one set operation before');

            let setters = this._set.Get();   
          
            let update = `update "${this._table}" set`;

            let values = "";    
            
            let whereSrt = PGSetHelper.ExtractWhereData(this);
                
            if(!whereSrt){

                if(this._whereAsString != undefined && this._statements.length > 0)
                {
                    throw new InvalidOperationException("Is not possible combine free and structured queries");
                }

                if(this._whereAsString != undefined)
                {
                    whereSrt = ` ${this._whereAsString} `;                
                }

                whereSrt = this.EvaluateWhere();

            }        

            let PK = SchemasDecorators.ExtractPrimaryKey(this._type);

            if(!PK)
                throw new InvalidOperationException(`The type ${this._type.name} must have a primary key field`);

            let pkColumn = Type.GetColumnNameAndType(this._type).filter(s => s.Field == PK)[0];

            for(let map of this._maps)
            {
                let set = setters.filter(s => s.Key == map.Field);

                if(set.length == 0)
                    continue;

                if(SchemasDecorators.IsPrimaryKey(this._type, map.Field))
                    continue;  
            
                if(set[0].Value == undefined || set[0].Value == null)
                {
                    values += `"${map.Column}" = null`;
                    continue;
                }

                let designType = Type.GetDesingType(this._type, map.Field);
                let relation = SchemasDecorators.GetRelationAttribute(this._type, map.Field);

                let subType = Type.GetDesingType(this._type, map.Field)!;

                if(!subType && !relation)
                    throw new InvalidOperationException(`Can not determine the relation of the property ${this._type}.${map.Field}`);                               

                let isArray = subType == Array;

                if(!subType && relation)
                    subType = relation.TypeBuilder();  

                if(isArray)
                {
                    if(!relation)
                        continue;
                    
                    subType = relation?.TypeBuilder();
                }
                
                let subPK = SchemasDecorators.ExtractPrimaryKey(subType);  

                if((designType && this._context.IsMapped(designType)) || (relation && this._context.IsMapped(relation.TypeBuilder())))
                {          
                    if(subPK == undefined)                
                        throw new InvalidOperationException(`The type ${subType.name} must have a primary key column`);    
                    
                    
                    let colletion = this._context.Collection(subType as {new (...args: any[]) : Object})!;
                    

                    if(isArray)
                    {
                        for(let i of set[0].Value as Array<typeof subType>)
                        {
                            if(i == undefined)
                                continue;        
                                
                            if(!Type.HasValue(Reflect.get(i as any, subPK)))
                                await (colletion as PGDBSet<typeof subType>)["AddAsync"](i as any);

                            if(relation)
                            {
                                let subRelation : typeof relation | undefined;
                                
                                for(let c of Type.GetColumnNameAndType(subType))
                                {
                                    let r = SchemasDecorators.GetRelationAttribute(subType, c.Field);
                                        
                                    if(r && r.Field == set[0].Key && r.TypeBuilder() == this._type){
                                        subRelation = r;
                                        break;
                                    }
                                }
                                    
                                if(subRelation && (subRelation.Relation == RelationType.ONE_TO_MANY || subRelation?.Relation == RelationType.MANY_TO_MANY)){
        
                                    let subDesingType = Type.GetDesingType(subType, relation.Field!);
                                        
                                    if(subDesingType == Array)
                                    {
                                        let subColumnName = Type.GetColumnNameAndType(subType).filter(s => s.Field == relation?.Field)[0];
                                        let subTableName = Type.GetTableName(subType); 
                                        let subPkColumn = Type.GetColumnNameAndType(subType).filter(s => s.Field == subPK)[0];
        
                                        let queryAllpks = `(select array_agg(${pkColumn.Column}) from ${this._table} ${whereSrt})`
            
                                        let subUpdate = `update ${subTableName} set ${subColumnName.Column} =  ${subColumnName.Column} || ${queryAllpks}  where "${subPkColumn.Column}" = ${this.CreateValueStatement(Type.CastType(subPkColumn.Type), Reflect.get(i as any, subPK))}`;
                                            
                                        await this._manager.ExecuteNonQueryAsync(subUpdate);   
                                    }                                                             
                                        
                                }                                        
                                    
                            }
                        }
                    }else{
        
                        if(set[0].Value == undefined)
                            continue; 

                        if(!Type.HasValue(Reflect.get(set[0].Value as any, subPK)))
                            await (colletion as PGDBSet<typeof subType>)["AddAsync"](set[0].Value as any);
                        
                        if(relation)
                        {
                            let subRelation : typeof relation | undefined;

                            for(let c of Type.GetColumnNameAndType(subType))
                            {
                                let r = SchemasDecorators.GetRelationAttribute(subType, c.Field);

                                if(r && r.Field == set[0].Key && r.TypeBuilder() == this._type){
                                    subRelation = r;
                                    break;
                                }
                            }
                            
                            if(subRelation && (subRelation.Relation == RelationType.ONE_TO_MANY || subRelation?.Relation == RelationType.MANY_TO_MANY)){

                                let subDesingType = Type.GetDesingType(subType, relation.Field!);
                                
                                if(subDesingType == Array)
                                {
                                    let subColumnName = Type.GetColumnNameAndType(subType).filter(s => s.Field == relation?.Field)[0];
                                    let subTableName = Type.GetTableName(subType); 
                                    let subPkColumn = Type.GetColumnNameAndType(subType).filter(s => s.Field == subPK)[0];

                                    let queryAllpks = `(select array_agg(${pkColumn.Column}) from ${this._table} ${whereSrt})`
    
                                    let subUpdate = `update ${subTableName} set ${subColumnName.Column} =  ${subColumnName.Column} || ${queryAllpks}  where "${subPkColumn.Column}" = ${this.CreateValueStatement(Type.CastType(subPkColumn.Type), Reflect.get(set[0].Value as any, subPK))}`;
                                    
                                    await this._manager.ExecuteNonQueryAsync(subUpdate);   
                                }                                                             
                                
                            }
                                
                            
                        }
                    }                    

                    let columnType = Type.CastType(Type.GetDesingTimeTypeName(subType, subPK)!);

                    if(relation?.Relation == RelationType.MANY_TO_MANY || relation?.Relation == RelationType.ONE_TO_MANY)
                        columnType = Type.AsArray(columnType) as DBTypes;                    
                     
    
                        let updateValues = [Reflect.get(set[0].Value as any, subPK)];
    
                        if(isArray)
                        {
                            updateValues = [];
        
                            for(let i of  set[0].Value as Array<typeof subType>)
                            {
                                if(i == undefined)
                                    continue;
    
                                updateValues.push(Reflect.get(i as any, subPK));
                            }
                        }
        
                        values += `"${map.Column}" = ${this.CreateValueStatement(columnType, isArray ? updateValues : updateValues[0])},`;
                            
                }else
                {
                    let colType = Type.CastType(map.Type);

                    if(SchemasDecorators.IsPrimaryKey(this._type, map.Field))
                        continue;               
    
                    values += `"${map.Column}" = ${this.CreateValueStatement(colType, set[0].Value)},`;
                    
                }

               
            }
            
            update = `${update} ${values.substring(0, values.length - 1)}`;

            update += " " + whereSrt;                 

            await this._manager.ExecuteNonQueryAsync(update);
        });
        
        
    }

    Set<K extends keyof T>(key: K, value: T[K]): AbstractSet<T> {     
                
        this._set.Add(key, value);

        return this;
    }

    public async UpdateAsync(obj : T) : Promise<T>
    {
        return await this.UpdateObjectAsync(obj, true);
    }

    public async UpdateObjectAndRelationsAsync(obj: T, relations: (keyof T)[]): Promise<T> {
       
        Type.DeleteMetadata(obj);

        return this.UpdateObjectAsync(obj, false, relations ? relations.map(s => s.toString()) : []);
    }

    private UpdateObjectAsync(obj : T, cascade? : boolean, relationsAllowed? : string[], fieldsAllowed? : string[], visiteds : any[] = []): Promise<T> {
        
        return this.CreatePromisse(async() => 
        {
            relationsAllowed = relationsAllowed ?? [];
            visiteds = visiteds ?? [];

            if(visiteds.indexOf(obj) > -1)
                return obj;            

            if(!this.IsCorrectType(obj))
                throw new InvalidOperationException(`The object passed as argument is not a ${this._type.name} instance`);
            
            if(!obj)
                throw new InvalidOperationException(`Cannot update a null reference object of ${this._type.name}`);


            let keys = Type.GetProperties(this._type).filter(p => SchemasDecorators.IsPrimaryKey(this._type, p));
            let wheres : IPGStatement[] = [];

            if(keys && keys.length > 0)
            {

                keys.forEach((w, i) => 
                {
                    let keyValue = Reflect.get(obj, w);

                    if(!keyValue)
                        throw new ConstraintFailException(`The field ${this._type.name}.${w} is a primary key but has no value`);

                    wheres.push({
                        Statement : {
                            Field : w, 
                            Kind : Operation.EQUALS, 
                            Value : Reflect.get(obj, w)
                        }, 
                        StatementType : i == 0 ? StatementType.WHERE : StatementType.AND
                    })
                });
            }

            let update = `update "${this._table}" set`;
            let values = "";

            let key : {Property : string, Column : string} | undefined;
            let subTypes : typeof this._maps = [];

            for(let map of this._maps)
            {
                let designType = Type.GetDesingType(this._type, map.Field);
                let relation = SchemasDecorators.GetRelationAttribute(this._type, map.Field);
                if((designType && this._context.IsMapped(designType)) || (relation && this._context.IsMapped(relation.TypeBuilder())))
                {
                    subTypes.push({
                        Column : map.Column, 
                        Field : map.Field, 
                        Type : map.Type
                    });
                    
                    continue;
                }

                let colType = Type.CastType(map.Type);

                if(SchemasDecorators.IsPrimaryKey(this._type, map.Field))
                {
                    key = 
                        {
                            Column : map.Column, 
                            Property : map.Field
                        }
                    continue;
                }

                if(fieldsAllowed && fieldsAllowed.length > 0 && fieldsAllowed.filter(s => s == map.Column).length == 0)
                    continue;

                values += `"${map.Column}" = ${this.CreateValueStatement(colType, Reflect.get(obj, map.Field))},`;

            }

            if(key == undefined)
                throw new InvalidOperationException(`The type ${this._type.name} must have a primary key column`);

            if(visiteds.filter(s => s && s.constructor == obj.constructor && Reflect.get(s, key!.Property) == Reflect.get(obj, key!.Property)).length > 0)
                return obj;
            
            visiteds.push(obj);
            
            update = `${update} ${values.substring(0, values.length - 1)}`;

            for(let where of wheres)
            {
                update += ` ${where.StatementType} ${this.EvaluateStatement(where)} `;
            }  

            if(values.trim().length > 1)
                await this._manager.ExecuteNonQueryAsync(update);
            
            let subTypesUpdates : string[] = [];
            let objectsToUpdate : {Objs : { Obj : any, UpdatableFields : string[]}[], Type : {new (...args: any[]) : unknown}, SubPK : string}[] = [];
            let objectsToAdd : {Objs : any[], Type : {new (...args: any[]) : unknown}, SubPK : string}[] = []; 
            let buildSubupdates : (() => void)[] = [];
            let updatableFields : string[] = [];

            for(let sub of subTypes)
            {
                let subObj = Reflect.get(obj, sub.Field);

                let metadata = Type.ExtractMetadata(obj);
                let meta = metadata.filter(s => s.Field == sub.Field && s.Loaded);

                let objetsToRemoveThisReferece : 
                {HasRelation : boolean, 
                    IsArray : boolean, 
                    SubIsArray : boolean, 
                    SubField : string, 
                    Relation : ReturnType<typeof SchemasDecorators.GetRelationAttribute> | undefined, 
                    SubRelation : ReturnType<typeof SchemasDecorators.GetRelationAttribute> | undefined
                } = 
                {HasRelation : false, IsArray : false, SubIsArray : false, SubField : "", Relation : undefined, SubRelation : undefined};

                if(((meta.length > 0 && meta[0].Loaded) || relationsAllowed.filter(s => s == sub.Field).length > 0) && subObj == undefined)
                {
                    subTypesUpdates.push(`"${sub.Column}" = null`);                    
                }           
                
                if(meta.length == 0 && relationsAllowed.filter(s => s == sub.Field).length == 0)
                    continue;
              

                let relation = SchemasDecorators.GetRelationAttribute(this._type, sub.Field);
                let subType = Type.GetDesingType(this._type, sub.Field)!;

                if(!subType && !relation)
                    throw new InvalidOperationException(`Can not determine the relation of the property ${this._type}.${sub.Field}`);
                    

                if(!subType && relation)
                {   
                    subType = relation.TypeBuilder();
                }

                let isArray = subType == Array;
                if(isArray)
                {
                    if(!relation)
                        continue;
                    
                    subType = relation?.TypeBuilder();
                }
                
                if((!cascade) && relationsAllowed.filter(s => s == sub.Field).length == 0 && this.GetChanges(meta, subObj, subType).length == 0)
                    continue;

                if(meta.length > 0)
                    relationsAllowed.push(meta[0].Field);

                let subPK = SchemasDecorators.ExtractPrimaryKey(subType);                
               
                if(subPK == undefined)                
                    throw new InvalidOperationException(`The type ${subType.name} must have a primary key column`);
                
                if(key == undefined)
                    throw new InvalidOperationException(`The type ${this._type.name} must have a primary key column`);

                let hasSubrelation = false;

                if(key != undefined){

                    let colletion = this._context.Collection(subType as {new (...args: any[]) : Object})!;

                    for(let subKey of Type.GetProperties(subType))
                    {
                        let subRelation = SchemasDecorators.GetRelationAttribute(subType, subKey);
                        
                        if(subRelation && subRelation.TypeBuilder() == this._type)
                        {

                            if(subRelation.Field != undefined && subRelation.Field != sub.Field)
                                continue;
                        
                            updatableFields.push(subKey);

                            objetsToRemoveThisReferece.HasRelation = true;
                            objetsToRemoveThisReferece.Relation = relation;
                            objetsToRemoveThisReferece.SubRelation = subRelation;
                            objetsToRemoveThisReferece.SubField = subKey;

                            hasSubrelation = true;                            

                            if(subRelation.Relation == RelationType.ONE_TO_MANY || subRelation.Relation == RelationType.MANY_TO_MANY)
                            {
                                let subFKTypeIsArray = Type.GetDesingType(subType, subKey) == Array; 

                                objetsToRemoveThisReferece.IsArray = isArray;
                                objetsToRemoveThisReferece.SubIsArray = subFKTypeIsArray;

                                if(subObj == undefined || visiteds.indexOf(subObj) > -1)
                                    continue;

                                if(isArray)
                                {
                                    if(subObj == undefined)
                                        continue;

                                    for(let i of subObj as Array<typeof subType>)
                                    {
                                        if(i == undefined || visiteds.indexOf(i) > -1)
                                            continue;
                                        
                                        if(subFKTypeIsArray)
                                        {
                                            let value : any[] = []; 

                                            let subMeta = Type.ExtractMetadata(i);

                                            if(subMeta.length > 0 && subMeta.filter(s => s.Field == subKey && s.Loaded).length > 0)
                                            {
                                                value = ((Reflect.get(i, subKey) ?? []) as Array<typeof subType>).filter(s => (s as any)[subPK!] != (obj as any)[subPK!]);  

                                            }else
                                            {
                                                let item = await (colletion as any)["Where"]({Field : subPK, Value : Reflect.get(i, subPK)})["LoadRelationOn"](subKey)["FirstOrDefaultAsync"]();
                                                value = item == undefined ? [] : item![subKey] as any[];
                                                value = value ?? [];
                                            }

                                            value = value.filter(s => Reflect.get(s, key!.Property) != Reflect.get(obj, key!.Property));

                                            value.push(obj);

                                            Reflect.set(i as any, subKey, value);

                                        }else{
                                            Reflect.set(i as any, subKey, obj);
                                        }

                                       
                                    }
                                }else{
                                    
                                        if(subObj == undefined || visiteds.indexOf(subObj) > -1)
                                            continue;

                                        if(subFKTypeIsArray)
                                        {
                                            let value : any[] = []; 

                                            let subMeta = Type.ExtractMetadata(subObj);

                                            if(subMeta.length > 0 && subMeta.filter(s => s.Field == subKey && s.Loaded).length > 0)
                                            {
                                                value = ((Reflect.get(subObj, subKey) ?? []) as Array<typeof subType>).filter(s => (s as any)[subPK!] != (obj as any)[subPK!]);  
                                            }else
                                            {
                                                let item = await (colletion as any)["Where"]({Field : subPK, Value : Reflect.get(subObj, subPK)})["LoadRelationOn"](subKey)["FirstOrDefaultAsync"]();
                                                value = item == undefined ? [] : item![subKey] as any[];
                                                value = value ?? [];
                                            }

                                            value = value.filter(s => Reflect.get(s, key!.Property) != Reflect.get(obj, key!.Property));
                                            value.push(obj);

                                            Reflect.set(subObj as any, subKey, value);

                                        }else{
                                            Reflect.set(subObj as any, subKey, obj);
                                        }

                                    
                                }
                               
                            }else{

                                if(subObj == undefined || visiteds.indexOf(subObj) > -1)
                                    continue;

                                if(subRelation.Relation == RelationType.MANY_TO_ONE)
                                {
                                    for(let i of subObj as Array<typeof subType>)
                                    {           
                                        if(i == undefined || visiteds.indexOf(i) > -1)
                                            continue;  

                                        Reflect.set(i as any, subKey, obj);
                                    }
                                }else{

                                    Reflect.set(subObj as any, subKey, obj);
                                }
                            }                                                      

                        }
                    }
                }


                let colletion = this._context.Collection(subType as {new (...args: any[]) : Object})!;

               
                if((cascade || relationsAllowed.filter(s => s == sub.Field).length > 0))
                    if(meta.length > 0 && objetsToRemoveThisReferece.HasRelation)
                    {           
                        let v = meta[0].Value;

                        let changes = this.GetChanges(meta, subObj, subType);

                        if(v instanceof Array)
                            meta[0].Value = meta[0].Value.filter((s : any) => changes.indexOf(s) == -1);
                        else if (v == changes[0])
                            meta[0].Loaded = false;

                        for(let c of changes)
                        {
                            let item = await (colletion as any)["Where"]({Field : subPK, Value : c})["LoadRelationOn"](objetsToRemoveThisReferece.SubField)["FirstOrDefaultAsync"]();
                            if(item)
                            {
                                if(objetsToRemoveThisReferece.SubIsArray)
                                {                                   
                                    item[objetsToRemoveThisReferece.SubField] = 
                                    (item[objetsToRemoveThisReferece.SubField] as Array<T>).filter(s => s && Reflect.get(s, key!.Property) != Reflect.get(obj, key!.Property));
                                   
                                }else if(objetsToRemoveThisReferece.SubRelation?.Relation != RelationType.ONE_TO_MANY){

                                    item[objetsToRemoveThisReferece.SubField] = undefined;
                                }   

                                await (colletion as PGDBSet<typeof subType>)["UpdateObjectAsync"](item as any, false, [], [], visiteds);
                            }
                        }
                        
                    }
                    
               
                if(isArray)
                {
                    if(subObj == undefined)
                        continue;

                    for(let i of subObj as Array<typeof subType>)
                    {
                        if(i == undefined)
                            continue;
    
                        if(!Type.HasValue(Reflect.get(i as any, subPK)))
                        {
                            let cs = objectsToAdd.filter(s => s.Type == subType);

                            if(cs.length == 0)
                                objectsToAdd.push({Objs : [i], Type : subType, SubPK : subPK});
                            else
                                cs[0].Objs.push(i);

                        }
                        else if((cascade || relationsAllowed.filter(s => s == sub.Field).length > 0))
                        {
                            let cs = objectsToUpdate.filter(s => s.Type == subType);
    
                            if(cs.length == 0)
                                objectsToUpdate.push({Objs : [{Obj : i,  UpdatableFields : updatableFields}] , Type : subType, SubPK : subPK});
                            else{

                                let ccs = cs.filter(s => s.Objs.filter(j => j.Obj == i).length > 0);

                                if(ccs.length == 0)
                                {
                                    cs[0].Objs.push({Obj : i,  UpdatableFields : updatableFields});

                                }else{        

                                    ccs[0].Objs[0].UpdatableFields.push(...updatableFields);
                                }
                            }
    
                        }
                    }


                }else{
    
                    if(subObj == undefined)
                        continue;
    
                    if(!Type.HasValue(Reflect.get(subObj as any, subPK)))
                    {
                        let cs = objectsToAdd.filter(s => s.Type == subType);

                        if(cs.length == 0)
                            objectsToAdd.push({Objs : [subObj], Type : subType, SubPK : subPK});
                        else
                            cs[0].Objs.push(subObj);

                    }
                    else if((cascade || relationsAllowed.filter(s => s == sub.Field).length > 0))
                    {
                        let cs = objectsToUpdate.filter(s => s.Type == subType);
    
                            if(cs.length == 0)
                                objectsToUpdate.push({Objs : [{Obj : subObj,  UpdatableFields : updatableFields}] , Type : subType, SubPK : subPK});
                            else{

                                let ccs = cs.filter(s => s.Objs.filter(j => j.Obj == subObj).length > 0);

                                if(ccs.length == 0)
                                {
                                    cs[0].Objs.push({Obj : subObj,  UpdatableFields : updatableFields});

                                }else{        
                                                                
                                    ccs[0].Objs[0].UpdatableFields.push(...updatableFields);
                                }
                            }


                    }
                } 
                                    
                buildSubupdates.push(() =>
                {
                    let spk = SchemasDecorators.ExtractPrimaryKey(subType)!;

                    let columnType = Type.CastType(Type.GetDesingTimeTypeName(subType, spk)!);

                    if(relation?.Relation == RelationType.MANY_TO_MANY || relation?.Relation == RelationType.ONE_TO_MANY || isArray)
                        columnType = Type.AsArray(columnType) as DBTypes;
                    
                    if(subObj == undefined)
                        return;
                    
                    let updateValues = [Reflect.get(subObj as any, spk)];
    
                    if(isArray)
                    {
                        updateValues = [];
    
                        for(let i of subObj as Array<typeof subType>)
                        {
                            if(i == undefined)
                                continue;
    
                            updateValues.push(Reflect.get(i as any, spk));
                        }
                    }

                    Type.InjectMetadata(
                        obj, 
                        {
                            Field: sub.Field, 
                            Type: columnType as DBTypes,
                            Value : updateValues, 
                            Loaded : true                                
                        }
                    );
    
                    subTypesUpdates.push(`"${sub.Column}" = ${this.CreateValueStatement(columnType, isArray ? updateValues : updateValues[0])}`);
                });
                               
            }

            objectsToAdd.forEach(o => 
                {
                    o.Objs =  o.Objs .filter((i, ix, s) => 
                    {
                        return ix == s.findIndex(v => v == i);
                    });
                });            
               
    
               
                
    
                for(let cs of objectsToAdd)
                {
                    let colletion = this._context.Collection(cs.Type as {new (...args: any[]) : Object})!;
    
                    for(let i of cs.Objs)
                        await (colletion as PGDBSet<typeof cs.Type>)["AddObjectAsync"](i as any, true, [], visiteds);
                }
    
                for(let cs of objectsToUpdate)
                {
                    let colletion = this._context.Collection(cs.Type as {new (...args: any[]) : Object})!;
    
                    for(let i of cs.Objs)
                        await (colletion as PGDBSet<typeof cs.Type>)["UpdateObjectAsync"](i.Obj as any, false, i.UpdatableFields ?? [], [], visiteds);
                }
    
                for(let b of buildSubupdates)
                    b();  

            if(subTypesUpdates.length > 0)
            {
                let subUpdate = `update "${Type.GetTableName(this._type)}" set `;

                for(let p of subTypesUpdates)
                {
                    subUpdate += `${p},`;
                }

                subUpdate = `${subUpdate.substring(0, subUpdate.length - 1)} where `;               
                
                subUpdate += this.EvaluateStatement({
                    StatementType : StatementType.WHERE, 
                    Statement : 
                    {
                        Field : key!.Property,
                        Kind : Operation.EQUALS, 
                        Value : Reflect.get(obj, key!.Property)
                    }
                });

                await this._manager.ExecuteNonQueryAsync(subUpdate);
            }

            return obj;
        });

    }


    protected GetChanges(meta : ReturnType<typeof Type.ExtractMetadata>, subObj : any, subType : new (...args : any[]) => unknown) : number[]
    {
        
        let v = meta[0].Value;
        let subPK = SchemasDecorators.ExtractPrimaryKey(subType)!;
        let g = Reflect.get;

        if(v == undefined)
            return [];

        if(v instanceof Array && subObj instanceof Array)
            if(v.length == 0 || v.every(s => subObj.find(u => g(u, subPK) == s)))
                return [];
            else
                return v.filter(s => !subObj.find(u => g(u, subPK) == s));
        
        if(v instanceof Array && subObj == undefined)
            return v;

        if(v && subObj == undefined)
            return [v];

        if(v != g(subObj, subPK))
            return [v];
         
        return[];
    }
    
    public DeleteSelectionAsync(): Promise<void> {
        
        return this.CreatePromisse(async()=>{

            let whereSrt = PGSetHelper.ExtractWhereData(this);          

            let query = `delete from "${this._table}"`; 

            if(!whereSrt){

                if(this._whereAsString != undefined && this._statements.length > 0)
                {
                    throw new InvalidOperationException("Is not possible combine free and structured queries");
                }

                if(this._whereAsString != undefined)
                {
                    query += ` ${this._whereAsString} `;                
                }

                query += this.EvaluateWhere();

            }else
            {
                query += whereSrt;
            }              

            await this._manager.ExecuteNonQueryAsync(query);

        });
    }

    DeleteAsync(obj : T): Promise<T> {
        return this.CreatePromisse(async() => 
        {
            if(!obj)
                throw new InvalidOperationException(`Cannot delete a null reference object of ${this._type.name}`);

            if(!this.IsCorrectType(obj))
                throw new InvalidOperationException(`The object passed as argument is not a ${this._type.name} instance`);
            
            let keys = Type.GetProperties(this._type).filter(p => SchemasDecorators.IsPrimaryKey(this._type, p));
            let wheres : IPGStatement[] = [];

            if(keys && keys.length > 0)
            {
                keys.forEach((w, i) => 
                {
                    wheres.push({
                        Statement : {
                            Field : w, 
                            Kind : Operation.EQUALS, 
                            Value : Reflect.get(obj, w)
                        }, 
                        StatementType : i == 0 ? StatementType.WHERE : StatementType.AND
                    })
                });
            }

            let del = `delete from "${this._table}" `;           
           

            for(let where of wheres)
            {
                del += ` ${where.StatementType} ${this.EvaluateStatement(where)} `;
            }  

            await this._manager.ExecuteNonQueryAsync(del);

            return obj;
        });
    }
    Where<K extends keyof T>(statement : IStatement<T, K>): AbstractSet<T> {       
       
       this._statements.push(
        {
            Statement : 
            {
                Field : statement.Field.toString(), 
                Kind : statement.Kind ?? Operation.EQUALS, 
                Value : statement.Value
            }, 
            StatementType : StatementType.WHERE
        });

        return this;
    }

    And<K extends keyof T>(statement : IStatement<T, K>): AbstractSet<T> {

        this._statements.push(
            {
                Statement : 
                {
                    Field : statement.Field.toString(), 
                    Kind : statement.Kind ?? Operation.EQUALS, 
                    Value : statement.Value
                },  
                StatementType : StatementType.AND
            });
    
            return this;
    }

    Or<K extends keyof T>(statement : IStatement<T, K>): AbstractSet<T> {

        this._statements.push(
        {
            Statement : 
            {
                Field : statement.Field.toString(), 
                Kind : statement.Kind ?? Operation.EQUALS, 
                Value : statement.Value
            }, 
            StatementType : StatementType.OR
        });

        return this;
    }
    
    public OrderBy<K extends keyof T>(key : K): AbstractSet<T> {
       
        this._ordering.push(
            {
                Field : key, 
                Order : OrderDirection.ASC
            });

        return this;

    }

    public Load<K extends keyof T>(key : K): AbstractSet<T> {
       
        this._includes.push(
            {
                Field : key                
            });

        return this;

    }

    public async ReloadCachedRealitionsAsync<K extends keyof T>(obj: T[], keys: K[]): Promise<void>;
    public async ReloadCachedRealitionsAsync<K extends keyof T>(obj: T, keys: K[]): Promise<void>;
    public async ReloadCachedRealitionsAsync(obj: any, keys: any): Promise<void> {
        
        let source : T[] = [];

        if(!obj)
            throw new InvalidOperationException('Can not load cached keys of undefined');

        if(obj.constructor == Array)
            source = obj.map(s => s);
        else
            source.push(obj);

        for(let k of keys)
        {
            let type = Type.GetFieldType(this._type, k);

            if(!type)
                throw new InvalidOperationException(`Can not determine the type of ${this._type.name}.${k}`);

            let pk = SchemasDecorators.ExtractPrimaryKey(type!);

            if(!pk)
                throw new InvalidOperationException(`The type ${type.name} must have a primary key field`);           

            if(!this._context.IsMapped(type))
                throw new InvalidOperationException(`Type ${type.name} of property ${this._type.name}.${k} is not mapped on this context`);

            let ids = [];

            for(let o of source)
            {
                let meta = Type.ExtractMetadata(o).filter(s => s.Field == k);

                if(meta.length == 0)
                    throw new InvalidOperationException(`Can not reload the key ${k} of a object without metadata`);

                let m = meta[0].Value;

                if(m != undefined && m != null)
                {
                    if(m.constructor == Array)
                        ids.push(...m);
                    else
                        ids.push(m);
                }
                
            }

            if(ids.length == 0)
                continue;

            let cachedObjects = await this._context.Collection(type).WhereField(pk).IsInsideIn(ids).ToListAsync();

            for(let o of source)
            {
                let m = Type.ExtractMetadata(o).filter(s => s.Field == k)[0]; 

                if(m.Value == undefined || m.Value == null)
                    (o as any)[k] = m.Value;
                else if(m.Value.constructor == Array)
                {
                    (o as any)[k] = cachedObjects.filter(s => m.Value.filter((u: any) => u == (s as any)[pk!]).length > 0);
                }else
                {
                    let i = cachedObjects.filter(s => m.Value == (s as any)[pk!]);

                    if(i.length > 0)
                        (o as any)[k] = i[0];
                }
            }
        }

    }

    public OrderDescendingBy<K extends keyof T>(key : K): AbstractSet<T> {
       
        this._ordering.push(
            {
                Field : key, 
                Order : OrderDirection.DESC
            });

        return this;

    }

    public Limit(limit : number): AbstractSet<T> {

        this._limit = limit >= 1 ? { Limit : limit} : undefined; 
        return this;
    }  

    public Offset(offset: number): AbstractSet<T> {
        
        this._offset = offset >= 1 ? { OffSet : offset} : undefined;
        return this;
    }

    public Take(quantity: number): AbstractSet<T> {
        
        return this.Limit(quantity);
    }

    public async CountAsync(): Promise<number> {

        return this.CreatePromisse(async () => 
        { 

            let whereSrt = PGSetHelper.ExtractWhereData(this);
            let sqlSrt = PGSetHelper.ExtractSQLData(this);

            let query = `select count(*) from "${this._table}"`;             
            
            if(sqlSrt && sqlSrt.toLowerCase().trim().startsWith(`select distinct "${this._table}".*`))
            {
                query = sqlSrt;
            }

            if(!whereSrt){

                if(this._whereAsString != undefined && this._statements.length > 0)
                {
                    throw new InvalidOperationException("Is not possible combine free and structured queries");
                }

                if(this._whereAsString != undefined)
                {
                    query += ` ${this._whereAsString} `;                
                }

                query += this.EvaluateWhere();

            }else
            {
                query += whereSrt;
            }            
                
            let ordenation = "";

            for(let orderby of this._ordering)
            {
                ordenation += `${this.EvaluateOrderBy(orderby)},`;
            }   

            if(this._ordering.length > 0)
            {
                query += ` order by ${ordenation.substring(0, ordenation.length - 1)}`
            }

            if(this._offset != undefined)
            {
                query += ` offset ${this._offset.OffSet}`;
            }
            
            if(this._limit != undefined)
            {
                query += ` limit ${this._limit.Limit}`;
            }

            if(sqlSrt && sqlSrt.toLowerCase().trim().startsWith(`select distinct "${this._table}".*`))
            {
                query = `select count(*) from (${query}) as counter`;
            }

            var r = await this._manager.ExecuteAsync(query);

            this.Reset();

            if(!r || r.rows.length == 0)
                return 0;          

            return Number.parseInt(r.rows[0].count);            

        });       
    } 

    public async ExistsAsync(): Promise<boolean> {
        
        this.Limit(1);
        return (await this.CountAsync() > 0);

    }
   
    public AsUntrackeds(): AbstractSet<T> {
        this._untrackeds = true;
        return this;
    }

   
    public async SelectAsync<U extends keyof T>(keys: U[]): Promise<{ [K in U]: T[K]; }[]> {
        
        for(let k of keys)
            if(this._maps.filter(s => s.Field == k.toString()).length > 0)
                this._selectedsFields.push(k.toString());
            else
                throw new ColumnNotExistsException(`The field ${this._type.name}.${k.toString()} is not mapped`);
        
        return (await this.AsUntrackeds().ToListAsync()).map(s => {

            let result = {} as { [K in U]: T[K] };

            keys.forEach(key => {
                result[key] = (s as any)[key.toString()];
            });

            return result;        
        });

                
    }

    public async ToListAsync(): Promise<T[]> {

        return this.CreatePromisse(async () => 
        {            
            let whereSrt = PGSetHelper.ExtractWhereData(this);
            let sqlSrt = PGSetHelper.ExtractSQLData(this);
            let selectQuery = this.EvaluateSelect();

            let query = `select ${selectQuery} from "${this._table}"`;  
            
            if(sqlSrt && sqlSrt.toLowerCase().trim().startsWith(`select distinct "${this._table}".`))
                query = sqlSrt;

            if(!whereSrt){

                if(this._whereAsString != undefined && this._statements.length > 0)
                {
                    throw new InvalidOperationException("Is not possible combine free and structured queries");
                }

                if(this._whereAsString != undefined)
                {
                    query += ` ${this._whereAsString} `;                
                }

                query += this.EvaluateWhere();

            }else
            {
                query += whereSrt;
            }                
                
            let ordenation = "";

            for(let orderby of this._ordering)
            {
                ordenation += `${this.EvaluateOrderBy(orderby)},`;
            }   

            if(this._ordering.length > 0)
            {
                query += ` order by ${ordenation.substring(0, ordenation.length - 1)}`
            }
            
            if(this._offset != undefined)
            {
                query += ` offset ${this._offset.OffSet}`;
            }

            if(this._limit != undefined)
            {
                query += ` limit ${this._limit.Limit}`;
            }

            var r = await this._manager.ExecuteAsync(query);

            if(r.rows.length == 0)
            {
                this.Reset();
                return [];                
            }

            let list : T[] = [];

            list = await this.BuildObjects(r);

            this.Reset();

            return list; 

        });       
    }    

    public async FirstOrDefaultAsync(): Promise<T | undefined> 
    {
        return this.CreatePromisse(async()=>{
            
            let rows = await this.Limit(1).ToListAsync();

            if(rows && rows.length > 0)
                return rows[0];

            return undefined;
        });
    }

    public WhereField<U extends keyof T, R extends PGDBSet<T>>(field: U): IFluentField<T, U, R> {        
        
        this.ResetFilters();

        return new PGFluentField(this as any as R, field, false);
    }
    public AndField<U extends keyof T, R extends PGDBSet<T>>(field: U): IFluentField<T, U, R> {        
        return new PGFluentField(this as any as R, field, false);
    }
    public OrField<U extends keyof T, R extends PGDBSet<T>>(field: U): IFluentField<T, U, R> {        
        return new PGFluentField(this as any as R, field, true);
    }
    

    public WhereAsString<R extends PGDBSet<T>>(where : string) : R
    {
        this.ResetFilters();

        if(where && !where.trim().toLocaleLowerCase().startsWith("where"))
        {
            where = `where ${where}`;
        }

        this._whereAsString = where;

        return this as any as R;
    }

    public LoadRelationOn<U extends keyof T, R extends PGDBSet<T>>(field: U): R {   

        return this.Load(field) as any as R;        
    }

    private CreatePromisse<T>(func : ()=> Promise<T>) : Promise<T>
    {
        return new Promise<T>(async (resolve, reject)=>{

            try
            {                
                resolve(await func());
            }
            catch(err)
            {
                reject(err);
            }
            finally
            {
                this.Reset();
            }            
        });
    }

    public CleanQueryTree(): void {

        this.Reset();
    }
   
    private CreateValueStatement(colType : DBTypes, value : any) : string
    {
        
        if(value == undefined || value == null)
            return 'null';

        if(colType == DBTypes.TEXT)
        {
            return `$$${value}$$`;

        }else if(colType == DBTypes.BOOLEAN)
        {
            return `${value.toString().toLowerCase()}`;
        }
        else if(Type.IsNumber(colType))
        {
            if(isNaN(value))
                throw new InvalidOperationException(`Can not cast the value "${value}" in a number`);

            return `${value}`.replace(',','.');

        }else if(Type.IsDate(colType))
        { 
            let dt : Date | undefined; 

            if(value.constructor == Date)
                dt = value as unknown as Date;
            else
                dt = this.CastStringToDate(value.toString());

            if(!dt)
                throw new InvalidOperationException(`Can not cast the value: "${value}" in a valid date`);

            let dtStr = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
                        
            if(colType == DBTypes.DATE)
            {
               return `'${dtStr}'::date`;
            }
            else
            {
                return `'${dtStr} ${dt.getHours()}:${dt.getMinutes()}'::timestamp` ;
            }
                        
        }else if (Type.IsArray(colType))
        {
            let valuesStr = 'array[';
            let elementType = Type.ExtractElementType(colType);
            let hasItens = false;

            for(let i of value)
            {   
                hasItens = true;
                valuesStr += `${this.CreateValueStatement(elementType, i)},`;
            }

            if(hasItens)
                valuesStr = valuesStr.substring(0, valuesStr.length - 1);
            
                valuesStr += `]::${this._manager["CastToPostgreSQLType"](colType)}`;

            return valuesStr;
        }

        throw new TypeNotSuportedException(`The type ${colType} is not suported`);
    }

    private CastStringToDate(date : string) : Date
    {
        if(!date)
            return new Date(Date.UTC(0,0,0)); 

        let parts = date.split('-');

        if(parts.length < 3)
            return new Date(Date.UTC(0,0,0)); 

        let time = parts[2].split(' ');  

        if(time.length == 1 && time[0].length > 4)
            time = parts[2].split('T');  
        
        parts[2] = time.shift()!;

        if(time.length == 0 || time[0].indexOf(':') == -1)
            time = ["0","0","0"];
        else
            time = time[0].split(':');    

        let dateParts : number[] = [];

        for(let p of parts)
        {
            let r = Number.parseInt(p);

            if(r == Number.NaN)
                return new Date(Date.UTC(0,0,0)); 
            
            dateParts.push(r);
        }

        let hours : number[] = [];
        for(let p of time)
        {
            let r = Number.parseInt(p);

            if(r == Number.NaN)           
                hours.push(0);
            else
                hours.push(r);

        }

        while(hours.length < 3)
            hours.push(0);
    
        return new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours[0], hours[1], hours[2]);       

    }

    private EvaluateSelect()
    {
        let selectQuery = `"${this._table}".*`;
        
        if(this._selectedsFields.length > 0)
        {
            selectQuery = "";
            for(let k of this._selectedsFields)
            {
                selectQuery += `"${this._table}".${this._maps.filter(s => s.Field == k.toString())[0].Column},`;
            }

            selectQuery = selectQuery.substring(0, selectQuery.length - 1);
        }
        
        return selectQuery;            
    }

    private EvaluateWhere()
    {
        let query = "";
        for(let i = 0; i < this._statements.length; i++)
        {
            let where = this._statements[i];

            if(i == 0 && where.StatementType != StatementType.WHERE)
                throw new InvalidOperationException(`The query three must start with a WHERE statement`);
                
            if(i > 0 && where.StatementType == StatementType.WHERE)
                where.StatementType = StatementType.AND;

            query += ` ${where.StatementType} ${this.EvaluateStatement(where)} `;
        }  
        return query;   
    }

    private EvaluateStatement(pgStatement : IPGStatement)
    {
        let column = Type.GetColumnName(this._type, pgStatement.Statement.Field.toString());
        let typeName = Type.GetDesingTimeTypeName(this._type, pgStatement.Statement.Field.toString());
        let operation = this.GetOperators(pgStatement.Statement.Kind);
        let type = Type.GetDesingType(this._type, pgStatement.Statement.Field.toString());
        let isArray = type == Array;
        let relation = SchemasDecorators.GetRelationAttribute(this._type, pgStatement.Statement.Field.toString());
        
        if(!type)
        {   
            if(!relation)
            {
                throw new InvalidOperationException(`Can not determine the correct type conversion for propety ${pgStatement.Statement.Field.toString()}`);
            }

            type = relation.TypeBuilder();
        } 

        if(pgStatement.Statement.Value == undefined)
            return `"${this._table}".${column} is null`;   
        
        if(this._context.IsMapped(type) || (relation && this._context.IsMapped(relation.TypeBuilder())))
        {
            if(!relation)
                throw new InvalidOperationException(`Can not determine the correct type conversion for propety ${pgStatement.Statement.Field.toString()}`);            

            if(isArray)
            {
                if(pgStatement.Statement.Value.length == 0)
                    return `("${this._table}".${column} is not null and coalesce(array_length("${this._table}".${column}, 1), 0) = 0)`;

                if((pgStatement.Statement.Value as any[]).filter(s => s == undefined || s == null).length > 0)
                    throw new InvalidOperationException(`Can not compare relations with null or undefined objets`);

                let c = pgStatement.Statement.Value[0];

                let k = SchemasDecorators.ExtractPrimaryKey(c.constructor);
                if(!k)
                    throw new ConstraintFailException(`The type ${c.constructor.name} must have a key field`);

                let elementType = Type.GetDesingTimeTypeName(c.constructor, k);

                let internalType = Type.CastType(elementType!);

                let keyType = Type.AsArray(internalType);
               
                let newValues : any[] = [];

                for(let e of pgStatement.Statement.Value)
                {       
                    newValues = [e[k]];             
                }

                typeName = keyType;
                pgStatement.Statement.Value = newValues as any;

            }else{

                let k = SchemasDecorators.ExtractPrimaryKey(pgStatement.Statement.Value.constructor);
                if(!k)
                    throw new ConstraintFailException(`The type ${pgStatement.Statement.Value.constructor.name} must have a key field`);
                
                let elementType = Type.GetDesingTimeTypeName(pgStatement.Statement.Value.constructor, k);

                let internalType = Type.CastType(elementType!);

                typeName = internalType;
                pgStatement.Statement.Value = pgStatement.Statement.Value[k];
            }
        }
        
        if(isArray)
        {
            if(!typeName)
                throw new InvalidOperationException(`Can not determine the correct type conversion for propety ${pgStatement.Statement.Field.toString()}`);

            if(pgStatement.Statement.Kind == Operation.EQUALS)
            {
                return `"${this._table}".${column} = ${this.CreateValueStatement(typeName as DBTypes, pgStatement.Statement.Value)}`; 
            }

            if(pgStatement.Statement.Kind == Operation.NOTEQUALS)
            {
                return `"${this._table}".${column} != ${this.CreateValueStatement(typeName as DBTypes, pgStatement.Statement.Value)}`; 
            }

            if(pgStatement.Statement.Kind == Operation.SMALLER || pgStatement.Statement.Kind == Operation.SMALLEROREQUALS)
            {
                return `"${this._table}".${column} <@ ${this.CreateValueStatement(typeName as DBTypes, pgStatement.Statement.Value)}`; 
            }

            if([Operation.STARTWITH, Operation.CONSTAINS, Operation.ENDWITH, Operation.GREATHER, Operation.GREATHEROREQUALS].includes(pgStatement.Statement.Kind))
            {
                return `"${this._table}".${column} @> ${this.CreateValueStatement(typeName as DBTypes, pgStatement.Statement.Value)}`; 
            }           
        }
        
        if(Type.IsNumber(Type.CastType(typeName!.toString())) || Type.IsDate(Type.CastType(typeName!.toString())))
        {

            operation[1] = "";
            operation[2] = "";  

            if(Type.IsDate(Type.CastType(typeName!.toString()))){                  
            
                   
                    let dt : Date = pgStatement.Statement.Value as unknown as Date;

                    if(!dt)
                        throw new InvalidOperationException(`Can not cast the value: "${pgStatement.Statement.Value}" in a valid date`);
        
                    let dtStr = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
                                
                    if(Type.CastType(typeName!.toString()) == DBTypes.DATE)
                    {
                        pgStatement.Statement.Value = `'${dtStr}'::date`;
                    }
                    else
                    {
                        pgStatement.Statement.Value = `'${dtStr} ${dt.getHours()}:${dt.getMinutes()}'::timestamp` ;
                    }
            }

            if([Operation.CONSTAINS, Operation.ENDWITH, Operation.STARTWITH].filter(s => s == pgStatement.Statement.Kind).length > 0)
            {
               throw new InvalidOperationException(`Can execute ${pgStatement.Statement.Kind.toString().toLocaleLowerCase()} only with text and array fields`);
            }        

        }else
        {
            operation[1] = `$$${operation[1]}`;
            operation[2] = `${operation[2]}$$`;
        }

        return `"${this._table}".${column} ${operation[0]} ${operation[1]}${pgStatement.Statement.Value}${operation[2]}`;
    }

    private EvaluateOrderBy(ordering : IPGOrdenation<T>)
    {
        let column = Type.GetColumnName(this._type, ordering.Field.toString());
        
        return ` "${this._table}".${column} ${ordering.Order}`;
    }


    private GetOperators(operation : Operation) : string[]
    {
        switch(operation)
        {
            case Operation.EQUALS : return ["=", "", ""];
            case Operation.CONSTAINS : return ["ilike", "%", "%"];
            case Operation.STARTWITH : return ["ilike", "", "%"];;
            case Operation.ENDWITH : return ["ilike", "%", ""];;
            case Operation.GREATHER : return [">", "", ""];;
            case Operation.GREATHEROREQUALS : return [">=", "", ""];;
            case Operation.SMALLER : return ["<", "", ""];;
            case Operation.SMALLEROREQUALS : return ["<=", "", ""];;
            case Operation.NOTEQUALS : return ["!=", "", ""];;
            default: throw new NotImpletedException(`The operation ${operation} is not supported`);
        }
    }

    private Reset() : void
    {       
        this._ordering = [];
        this._includes = [];
        this._limit = undefined;  
        this._set = new PGSetValue<T>();    
        this._untrackeds = false; 
        this._selectedsFields = [];
        this.ResetFilters();
    }

    private ResetFilters() : void
    {
        this._statements = [];       
        this._whereAsString = undefined;
        PGSetHelper.CleanORMData(this);
    }

    private IsCorrectType(obj : any) : boolean
    {
        let sameCTor = obj && obj.constructor && obj.constructor == this._type;

        if(sameCTor)
            return true;
        
        if(obj.prototype == this._type)
            return true;
        
        if(obj.prototype && obj.prototype.constructor == this._type)
            return true;
        
        let objectKeys = Object.keys(obj);

        for(let map of this._maps)
        {
            let v = obj[map.Field];

            if(v == undefined)
            {
                let exists = objectKeys.filter(s => s == map.Field).length > 0;

                if(!exists)
                {
                    let allowNull = SchemasDecorators.AllowNullValue(this._type, map.Field);

                    if(!allowNull)
                        return false;
                }
            }
        }

        obj.__proto__ = this._type;
        return true;
    }

    private async BuildObjects(r : any) : Promise<T[]>
    {
        let list : T[] = [];

        for(let row of r.rows)
        {
            let instance = Reflect.construct(this._type, []) as T;

            for(let map of this._maps)
            {
                let type = Type.GetDesingType(this._type, map.Field);
                let relation = SchemasDecorators.GetRelationAttribute(this._type, map.Field);
                if((!type || type === Array) && relation)
                    type = relation.TypeBuilder();

                if(!this._context.IsMapped(type!)){

                    let v = Reflect.get(row, map.Column);

                    let vType = Type.CastType(map.Type);

                    if(v != undefined){

                        if([DBTypes.INTEGER, DBTypes.LONG, DBTypes.SERIAL].includes(vType))
                            Reflect.set(instance, map.Field,  Number.parseInt(v));
                        else if(DBTypes.DOUBLE == vType)
                            Reflect.set(instance, map.Field,  Number.parseFloat(v));
                        else if([DBTypes.DATE, DBTypes.DATETIME].includes(vType)){

                            try{
                                v = new Date(v);
                            }catch{}

                            Reflect.set(instance, map.Field, v);
                        }  
                        else if(DBTypes.TEXT == vType)
                            Reflect.set(instance, map.Field, v.toString());
                        else 
                            Reflect.set(instance, map.Field, v);                          
                        
                    }
                    else 
                        Reflect.set(instance, map.Field, v);
                    
                    
                    
                }
                else {                   

                    if(Reflect.get(row, map.Column) == undefined)
                    {
                        if(!this._untrackeds)
                        {
                            Type.InjectMetadata(
                                instance, 
                                {
                                    Field: map.Field, 
                                    Type: map.Type as DBTypes,
                                    Value : Reflect.get(row, map.Column), 
                                    Loaded : this._includes.filter(s => s.Field == map.Field).length > 0                                
                                }
                            );
                        }
                        continue;
                    }

                    let includeType = this._includes.filter(s => s.Field == map.Field);

                    let loaded : boolean = false;

                    if(includeType.length > 0)
                    {
                        loaded = true;
                        
                        let colletion = this._context.Collection(type! as {new (...args: any[]) : Object})!;

                        if(colletion == undefined)
                            continue;

                        (colletion as any)["Reset"]();

                        let subKey = SchemasDecorators.ExtractPrimaryKey(type!)!;

                        if(relation?.Relation == RelationType.MANY_TO_MANY || relation?.Relation == RelationType.ONE_TO_MANY)
                        {
                            let values = Reflect.get(row, map.Column);

                            if(!values || values.length == 0)
                            {
                                Reflect.set(instance, map.Field, []);

                            }else{

                                colletion.Where({
                                    Field : subKey as keyof typeof type, 
                                    Kind : Operation.EQUALS, 
                                    Value : values[0] as typeof type[keyof typeof type & string]
                                });
    
                                for(let i = 0; i < values.length; i++)
                                {
                                    if(i == 0)
                                        continue;
    
                                    colletion.Or({
                                        Field : subKey as keyof typeof type, 
                                        Kind : Operation.EQUALS, 
                                        Value : values[i] as typeof type[keyof typeof type & string]
                                    });
                                }
    
                                if(this._untrackeds)
                                    colletion.AsUntrackeds();

                                let subObjets = await colletion.ToListAsync();
                                Reflect.set(instance, map.Field, subObjets);
                            }                            

                        }else{

                            colletion.Where({
                                Field : subKey as keyof typeof type, 
                                Kind : Operation.EQUALS, 
                                Value : Reflect.get(row, map.Column) as typeof type[keyof typeof type & string]
                            });

                            if(this._untrackeds)
                                colletion.AsUntrackeds();
                            
                            let subObjet = await colletion.FirstOrDefaultAsync();
                            Reflect.set(instance, map.Field, subObjet);

                        }

                        
                    }

                    if(!this._untrackeds)
                    {
                        Type.InjectMetadata(
                            instance, 
                            {
                                Field: map.Field, 
                                Type: map.Type as DBTypes,
                                Value : Reflect.get(row, map.Column), 
                                Loaded : loaded                                
                            }
                        );
                    }

                }
            }
                          
            list.push(instance);
        }

        return list;
    }
    
}

class PGSetValue<T>
{
    private _sets : {Key : keyof T, Value : T[keyof T]}[]= [];

    public Add<K extends keyof T>(key : K, value : T[K]) : void
    {
        let i = this._sets.filter(s => s.Key == key);

        if(i.length > 0)
        {
            i[0].Value = value;
        }
        else
        {
            this._sets.push({Key : key, Value : value});
        }
    }

    public Get() : {Key : keyof T, Value : T[keyof T]}[]
    {
        return this._sets;       
    }
}

interface IPGStatement
{
    StatementType : StatementType;
    Statement : 
    {
        Field : string;
        Kind : Operation, 
        Value : any
    }
}

interface IPGOrdenation<T>
{
    Field : keyof T,
    Order : OrderDirection
}


interface IPGIncluding<T>
{
    Field : keyof T    
}

interface IPGLimiter
{
    Limit : number
}

interface IPGOffset
{
    OffSet : number
}


enum OrderDirection
{
    ASC = 'asc', 
    DESC = 'desc'
}

enum StatementType
{
    WHERE = "where",
    OR = "or", 
    AND = "and"
}

