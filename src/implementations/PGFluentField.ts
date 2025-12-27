import { IFluentField, AbstractFluentField, Operation } from "myorm_core";

import PGDBSet from "./PGDBSet";


export default class PGFluentField<T extends object, K extends keyof T, P extends PGDBSet<T>> extends AbstractFluentField<T, K, P>
{
    private _pgSet : P;
    private _field : keyof T;
    private _isOr : boolean;


    constructor(pgSet : P, field : keyof T, isOr : boolean = false)
    {
        super();
        this._pgSet = pgSet;
        this._field = field;
        this._isOr = isOr;
    }

    public IsGreaterThan(value: T[K]): P {

        if(this._isOr)
        {
            this._pgSet.Or({
                Field : this._field,
                Kind : Operation.GREATHER, 
                Value : value 
            });
    
            return this._pgSet;
        }

        this._pgSet.Where({
            Field : this._field,
            Kind : Operation.GREATHER, 
            Value : value 
        });

        return this._pgSet;
    }


    public IsEqualTo(value: T[K]): P  {

        if(this._isOr)
        {
            this._pgSet.Or({
                Field : this._field,               
                Value : value 
            });
    
            return this._pgSet;
        }

        this._pgSet.Where({
            Field : this._field,            
            Value : value
        });

        return this._pgSet;
    }


    public IsNotEqualTo(value: T[K]): P {

        if(this._isOr)
        {
            this._pgSet.Or({
                Field : this._field,
                Kind : Operation.NOTEQUALS, 
                Value : value 
            });
    
            return this._pgSet;
        }

        this._pgSet.Where({
            Field : this._field, 
            Kind : Operation.NOTEQUALS,           
            Value : value 
        });

        return this._pgSet;
    }


    public IsSmallerThan(value: T[K]): P  {

        if(this._isOr)
        {
            this._pgSet.Or({
                Field : this._field,
                Kind : Operation.SMALLER, 
                Value : value 
            });
    
            return this._pgSet;
        }

        this._pgSet.Where({
            Field : this._field,
            Kind : Operation.SMALLER, 
            Value : value 
        });

        return this._pgSet;
    }


    public IsInsideIn(value: T[K][]): P  {

       for(let i = 0; i < value.length; i++)
       {
            if(i == 0 && !this._isOr)
            {
                this._pgSet.Where({
                    Field : this._field,                 
                    Value : value[i]
                });
            }
            else 
            {
                this._pgSet.Or({
                    Field : this._field,                 
                    Value : value[i]
                });
            }            
        }

        return this._pgSet;
    }


    public Contains(value: T[K]): P  {

        if(this._isOr)
        {
            this._pgSet.Or({
                Field : this._field,
                Kind : Operation.CONTAINS, 
                Value : value 
            });
    
            return this._pgSet;
        }

        this._pgSet.Where({
            Field : this._field,  
            Kind : Operation.CONTAINS,               
            Value : value
        });     

        return this._pgSet;
    }


    public StartsWith(value: T[K]): P  {

        if(this._isOr)
        {
            this._pgSet.Or({
                Field : this._field,
                Kind : Operation.STARTWITH, 
                Value : value 
            });
    
            return this._pgSet;
        }

        this._pgSet.Where({
            Field : this._field,  
            Kind : Operation.STARTWITH,               
            Value : value
        });     

        return this._pgSet;
    }


    public EndsWith(value: T[K]): P  {

        if(this._isOr)
        {
            this._pgSet.Or({
                Field : this._field,
                Kind : Operation.ENDWITH, 
                Value : value 
            });
    
            return this._pgSet;
        }

        this._pgSet.Where({
            Field : this._field,  
            Kind : Operation.ENDWITH,               
            Value : value
        });     

        return this._pgSet;
    }

    public IsNull(): P  {

        if(!this._isOr)
        {
            this._pgSet.Where({
                Field : this._field,                 
                Value : undefined as unknown as T[keyof T]
            });
        }
        else 
        {
            this._pgSet.Or({
                Field : this._field,                 
                Value : undefined as unknown as T[keyof T]
            });
        }        
 
         return this._pgSet;
     }
    
}