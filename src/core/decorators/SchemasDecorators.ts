

import { DBTypes } from '../enums/DBTypes';
import Type from '../design/Type';
import { RelationType } from '../enums/RelationType';
import OwnMetaDataContainer from '../design/OwnMetaDataContainer';

export default class SchemasDecorators
{
    

    private static _tableAttribute : string = "compile:schema-table";
    private static _columnAttribute : string = "compile:schema-column";
    private static _dataTypeAttribute : string = "compile:schema-dataType";
    private static _primaryKeyAttribute : string = "compile:schema-primarykey";    
    private static _relationAttribute : string = "compile:schema-relationWith"; 
    private static _notNullAttribute : string = "compile:schema-notNull"; 
    private static _decoratedPropertiesTypeKey : string = "di:decorated-properties"; 

    public static DefinePropertyAsDecorated(ctor: Function, property : string)
    {
        let meta = SchemasDecorators.GetDecotaredProperties(ctor);

        let index = meta.findIndex(d => d == property);

        if(index == -1)
            meta.push(property);     

        OwnMetaDataContainer.Set(ctor, SchemasDecorators._decoratedPropertiesTypeKey, undefined, meta);

    }

    public static GetDecotaredProperties(ctor: Function) : string[]
    {
        let current = ctor as any;
        let meta : string[] = [];
        
        while(current)
        {           

            let superMeta = ((OwnMetaDataContainer.Get(current, SchemasDecorators._decoratedPropertiesTypeKey)?.Value ?? []) as string[])
            if(superMeta instanceof Array)
                meta.push(...superMeta);
            current = current.__proto__;
        }  

        return meta;
    }
    

    public static Table(name? : string)
    {
        return function (target : Object)
        {
            
            OwnMetaDataContainer.Set(typeof target == "function" ? target : target.constructor, SchemasDecorators._tableAttribute, undefined, name ?? (typeof target == "function" ? target : target.constructor as Function).name.toLowerCase());
            Reflect.defineMetadata(SchemasDecorators._tableAttribute, name ?? ((typeof target == "function" ? target : target.constructor) as Function).name.toLowerCase(), typeof target == "function" ? target.prototype : target);
        }
    }

    public static GetTableAttribute(target : Object) : string | undefined
    {
        

        let meta = Reflect.getMetadata(SchemasDecorators._tableAttribute, typeof target == "function" ? target.prototype : target);

        if(!meta)
            meta = OwnMetaDataContainer.Get(typeof target == "function" ? target : target.constructor, SchemasDecorators._tableAttribute, undefined)?.Value;
        
        return meta;
    }

    
    public static Column(name? : string)
    {
        return function (target : Object, propertyName : string)
        {
           
            SchemasDecorators.DefinePropertyAsDecorated(typeof target == "function" ? target : target.constructor, propertyName.toString());
            OwnMetaDataContainer.Set(typeof target == "function" ? target : target.constructor, SchemasDecorators._columnAttribute, propertyName, name ?? propertyName.toLowerCase());
            Reflect.defineMetadata(SchemasDecorators._columnAttribute, name ?? propertyName.toLowerCase(), typeof target == "function" ? target.prototype : target, propertyName);
        }
    }    

    public static GetColumnAttribute(cTor : Function, propertyName : string) : string | undefined
    {
        let meta =  Reflect.getMetadata(SchemasDecorators._columnAttribute, cTor.prototype, propertyName);

        if(!meta)
            meta = OwnMetaDataContainer.Get(cTor, SchemasDecorators._columnAttribute, propertyName)?.Value;
        
        return meta;
    }

    private static MarkAsColumn(target : Object, propertyName : string)
    {
        let column = this.GetColumnAttribute(typeof target == "function" ? target : target.constructor, propertyName);

        if(!column)
        {
            SchemasDecorators.DefinePropertyAsDecorated(typeof target == "function" ? target : target.constructor, propertyName.toString());
            OwnMetaDataContainer.Set(typeof target == "function" ? target : target.constructor, SchemasDecorators._columnAttribute, propertyName, propertyName.toLowerCase());
            Reflect.defineMetadata(SchemasDecorators._columnAttribute, propertyName.toLowerCase(), typeof target == "function" ? target.prototype : target, propertyName);
        }
    }

    public static NotNull()
    {
        return function (target : Object, propertyName : string)
        {
            SchemasDecorators.MarkAsColumn(target, propertyName);
            SchemasDecorators.DefinePropertyAsDecorated(typeof target == "function" ? target : target.constructor, propertyName.toString());
            OwnMetaDataContainer.Set(typeof target == "function" ? target : target.constructor, SchemasDecorators._notNullAttribute, propertyName, true);
            Reflect.defineMetadata(SchemasDecorators._notNullAttribute, true, typeof target == "function" ? target.prototype : target, propertyName);
        }
    }    

    public static AllowNullValue(cTor : Function, propertyName : string) : boolean
    {        
        let meta =  Reflect.getMetadata(SchemasDecorators._notNullAttribute, cTor.prototype, propertyName);

        if(meta == undefined)
            meta = OwnMetaDataContainer.Get(cTor, SchemasDecorators._notNullAttribute, propertyName)?.Value ?? false;
        
        return !meta;
    }


    public static OneToOne<T>(lazyBuilder : () =>  {new (...args: any[]) : T}, property? : keyof T & string)
    {
        return SchemasDecorators.Relation<T>(lazyBuilder, RelationType.ONE_TO_ONE, property);
    }    

    public static OneToMany<T>(lazyBuilder : () =>  {new (...args: any[]) : T}, property? : keyof T & string)
    {
        return SchemasDecorators.Relation<T>(lazyBuilder, RelationType.ONE_TO_MANY, property);
    }   

    public static ManyToOne<T>(lazyBuilder : () =>  {new (...args: any[]) : T}, property? : keyof T & string)
    {
        return SchemasDecorators.Relation<T>(lazyBuilder, RelationType.MANY_TO_ONE,property);
    }   

    public static ManyToMany<T>(lazyBuilder : () =>  {new (...args: any[]) : T}, property? : keyof T & string)
    {
        return SchemasDecorators.Relation<T>(lazyBuilder, RelationType.MANY_TO_MANY, property);
    } 

    private static Relation<T>(lazyBuilder : () =>  {new (...args: any[]) : T}, relation : RelationType, property? : keyof T & string)
    {
        return function (target : Object, propertyName : string)
        {

            SchemasDecorators.MarkAsColumn(target, propertyName);
            SchemasDecorators.DefinePropertyAsDecorated(typeof target == "function" ? target : target.constructor, propertyName.toString());
            OwnMetaDataContainer.Set(typeof target == "function" ? target : target.constructor, SchemasDecorators._relationAttribute, propertyName,  { TypeBuilder : lazyBuilder, Relation : relation, Field : property });
            Reflect.defineMetadata(SchemasDecorators._relationAttribute, { TypeBuilder : lazyBuilder, Relation : relation, Field : property }, typeof target == "function" ? target.prototype : target, propertyName);
        }
    }

    public static GetRelationAttribute(cTor : Function, propertyName : string) : { TypeBuilder :() => {new (...args: any[]) : unknown}, Relation : RelationType, Field? : string } | undefined
    {

        let meta = Reflect.getMetadata(SchemasDecorators._relationAttribute, typeof cTor == "function" ? cTor.prototype : cTor, propertyName) as { TypeBuilder : () => {new (...args: any[]) : unknown}, Relation  : RelationType, Field? : string };
        
        if(!meta)
            meta = OwnMetaDataContainer.Get(cTor, SchemasDecorators._relationAttribute, propertyName)?.Value  as { TypeBuilder :() => {new (...args: any[]) : unknown}, Relation : RelationType, Field? : string }; 
    
        return meta;
    }

       
    
    public static PrimaryKey()
    {
        return function (target : Object, propertyName : string)
        {

            SchemasDecorators.MarkAsColumn(target, propertyName);
            SchemasDecorators.DefinePropertyAsDecorated(typeof target == "function" ? target : target.constructor, propertyName.toString());
            OwnMetaDataContainer.Set(typeof target == "function" ? target : target.constructor, SchemasDecorators._primaryKeyAttribute, propertyName,  true);
            Reflect.defineMetadata(SchemasDecorators._primaryKeyAttribute, true , typeof target == "function" ? target.prototype : target, propertyName);
        }
    }

    public static IsPrimaryKey(cTor : Function, propertyName : string) : boolean 
    {
        
        let meta =  Reflect.getMetadata(SchemasDecorators._primaryKeyAttribute, typeof cTor == "function" ? cTor.prototype : cTor, propertyName);

        if(!meta)
            meta = OwnMetaDataContainer.Get(cTor, SchemasDecorators._primaryKeyAttribute, propertyName)?.Value ?? false; 
        
        return meta;
    }

    public static ExtractPrimaryKey(cTor : {new (...args: any[]) : unknown}) : string | undefined
    {
        for(let prop of  Type.GetProperties(cTor))
        {
            if(SchemasDecorators.IsPrimaryKey(cTor, prop))
                return prop;
        }

        return undefined;
    }


    public static DataType(type : DBTypes) {

        return function (target : Object, propertyName : string)
        {
            SchemasDecorators.MarkAsColumn(target, propertyName);
            SchemasDecorators.DefinePropertyAsDecorated(typeof target == "function" ? target : target.constructor, propertyName.toString());
            OwnMetaDataContainer.Set(typeof target == "function" ? target : target.constructor, SchemasDecorators._dataTypeAttribute, propertyName,  type);
            Reflect.defineMetadata(SchemasDecorators._dataTypeAttribute, type, typeof target == "function" ? target.prototype : target, propertyName);
        }
    }   

    public static GetDataTypeAttribute(cTor : Function, propertyName : string) : DBTypes | undefined
    {

        let value = Reflect.getMetadata(SchemasDecorators._dataTypeAttribute, cTor.prototype, propertyName);

        if(!value)
            value = OwnMetaDataContainer.Get(cTor, SchemasDecorators._dataTypeAttribute, propertyName)?.Value; 

        if(value === undefined)
            return undefined;
        else 
            return value as DBTypes;
    }


}
