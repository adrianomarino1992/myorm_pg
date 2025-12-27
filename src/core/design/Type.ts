
import SchemasDecorators from '../decorators/SchemasDecorators';
import { DBTypes } from '../enums/DBTypes';
import TypeNotSuportedException from '../exceptions/TypeNotSuportedException';
import NotImpletedException from '../exceptions/NotImplementedException';

export default class Type
{
    public static GetProperties(cTor : Function)
    {
        let empty = Reflect.construct(cTor, []);

        let keys = Object.keys(empty);
        
        SchemasDecorators.GetDecotaredProperties(cTor).forEach(k => 
        {
            if(keys.findIndex(v => v == k) == -1)
                keys.push(k);
        });

        return keys;
    }

    public static GetDesingType(cTor : Function, propertyName : string) : {new (...args: any[]) : unknown} | undefined
    {
        return Reflect.getMetadata("design:type", cTor.prototype, propertyName) as {new (...args: any[]) : unknown};
    }

    public static GetDesingTimeTypeName(cTor : Function, propertyName : string) : string | undefined
    {        

        let type = SchemasDecorators.GetDataTypeAttribute(cTor, propertyName);

        if(type == undefined)
            type = Reflect.getMetadata("design:type", cTor.prototype, propertyName);

            if(typeof type === "function")
                type = (type as any).name;        

        return type?.toString();
        
    }

    public static AsArray(type : string) : string
    {

        if(type == "serial")
            return DBTypes.INTEGERARRAY;

        if(type.endsWith("[]"))
            return type;
        else 
            return `${type}[]`; 
        
    }
   
    public static InjectMetadata(object : any, metadata : {Field : string, Type : DBTypes, Value : any, Loaded : boolean})
    {
        let meta = Type.ExtractMetadata(object);

        meta = meta.filter(s => s.Field != metadata.Field);

        meta.push(metadata);

        Reflect.set(object, '_orm_metadata_', meta);
    }

    public static ExtractMetadata(object : any) : Parameters<typeof Type.InjectMetadata>[1][]
    {
        return Reflect.get(object, '_orm_metadata_') as Parameters<typeof Type.InjectMetadata>[1][] ?? [];       
    }

    public static DeleteMetadata(object : any) : void
    {       
        if(Reflect.has(object, "_orm_metadata_"))
        {
            delete object._orm_metadata_;
        }        
    }

    public static GetTableName(cTor : Function) : string 
    {
        return SchemasDecorators.GetTableAttribute(cTor) ?? cTor.name.toLowerCase();
    }

    public static GetColumnName(cTor : Function, key : string) : string 
    {
        return SchemasDecorators.GetColumnAttribute(cTor, key)!;
    }

    public static HasValue(obj : any) : boolean
    {
        if(typeof obj == "string")
        {
            return obj.length > 0;
        }

        if(typeof obj == "number")
        {
            return obj > 0;
        }

        if(typeof obj == "object")
        {
            return obj != undefined;
        }

        return false;
    }

    public static GetColumnNameAndType(cTor : Function) : { Field : string, Column : string, Type : string }[]
    {  
        let keys = Type.GetProperties(cTor).filter(s => SchemasDecorators.GetColumnAttribute(cTor, s) != undefined);

        let values :  { Field : string, Column : string, Type : string }[] = []

        for(let key of keys)
        {
            let meta = Type.GetColumnName(cTor, key);
            let type = Type.GetDesingTimeTypeName(cTor, key);
            let relation = SchemasDecorators.GetRelationAttribute(cTor, key);

            if(!type && relation)
                type = relation.TypeBuilder().name;

            if(meta != undefined && type)
            {               
                values.push({
                    Field : key.toString(), 
                    Column : meta, 
                    Type : type
                });
            }            
        }

        return values;

    }

    public static GetFieldType<T>(cTor : new (...args: any[]) => T, key : keyof T) : (new (...args: any[]) => any) | undefined
    {        
        let type = Type.GetDesingType(cTor, key.toString());
        let relation = SchemasDecorators.GetRelationAttribute(cTor, key.toString());

        if(relation)
            type = relation.TypeBuilder();

        if(type == Array)
            return undefined;

        return type!;
    }

    public static IsArray(dbType : string)
    {
        switch(dbType.toLowerCase())
        {
            case DBTypes.INTEGERARRAY : return true;
            case DBTypes.TEXTARRAY : return true;            
            case DBTypes.BOOLEANARRAY : return true;            
            case DBTypes.DATEARRAY : return true;            
            case DBTypes.DATETIMEARRAY : return true;            
            case DBTypes.LONGARRAY : return true;            
            case DBTypes.DOUBLEARRAY : return true;            
        }
        return false;
    }

    public static ExtractElementType(dbType : string)
    {
       return dbType.toLowerCase().toString().replace('[]', '') as DBTypes;
    }

    public static IsDate(dbType : string)
    {
        switch(dbType.toLowerCase())
        {
            case DBTypes.DATE : return true;
            case DBTypes.DATETIME : return true;            
        }

        return false;
    }

    public static IsNumber(dbType : string)
    {
        switch(dbType.toLowerCase())
        {
            case DBTypes.LONG : return true;
            case DBTypes.SERIAL : return true;
            case DBTypes.INTEGER : return true;
            case DBTypes.DOUBLE : return true;
        }

        return false;
    }

    public static IsText(dbType : string)
    {
        switch(dbType.toLowerCase())
        {
            case DBTypes.TEXT : return true;            
        }

        return false;
    }

    /**
     * 
     * @method
     * @param {string} type the type from desing type to be converted to a DBTypes enum
     * @returns the DBTypes correspondent
     */
    public static CastType(type : string) : DBTypes
    {
        
        for(let k in DBTypes)
        {
            if((DBTypes as any)[k] == type.toLowerCase().trim())
                return (DBTypes as any)[k]
        }

        switch(type.toLowerCase())
        {           
            case "number" : return DBTypes.DOUBLE;            
            case "string" : return DBTypes.TEXT;            
            case "object" : return DBTypes.CLASS;

            default: throw new TypeNotSuportedException(`The type ${type} is not suported or is not mapped in this instance of PGContext`);
        }
    }
}