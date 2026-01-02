import { PrimaryKey, Column, DataType, DBTypes } from "../../src/Index";


export abstract class Entity {
    @PrimaryKey()    
    @DataType(DBTypes.SERIAL)
    public Id: number = -1;
}



