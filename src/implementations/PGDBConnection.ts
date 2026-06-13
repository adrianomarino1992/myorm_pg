import pg  from 'pg';

import ConnectionFailException from "../core/exceptions/ConnectionFailException";
import QueryFailException from "../core/exceptions/QueryFailException";
import {AbstractConnection} from 'myorm_core';
import { InvalidOperationException, PGDBManager } from '../Index';


export default class PGDBConnection extends AbstractConnection
{
    protected static _pools : {[key: string] : pg.Pool} = {}; 

    public HostName!: string;
    public Port!: number;
    public DataBaseName!: string;
    public UserName!: string;
    public PassWord!: string; 
    public InPoolMode! : boolean;
    public MinPool!: number;
    public MaxPool!: number;
    public IsOpen: boolean;
    private _conn! : pg.Client | pg.PoolClient;
    private _originalDatabase! : string;   
    private _originalUsePoolMode! : boolean;   
    private _inTransactionMode : boolean = false;
 

    constructor(host : string, port : number, database : string, user : string, pass : string, usePool : boolean = true, min: number = 2, max: number = 10)
    {        
        super();
        this.HostName = host;
        this.Port = port;
        this.DataBaseName = database;
        this._originalDatabase = database;
        this.UserName = user;
        this.PassWord = pass;  
        this._originalUsePoolMode = usePool;
        this.InPoolMode = usePool;
        this.MinPool = min;
        this.MaxPool = max;
        this.IsOpen = false;      
    }     

    protected GetConnectionIdentifier()
    {
        return `${this.DataBaseName}${this.HostName}${this.Port}${this.UserName}`;
    }

    public static async CloseAllPoolsAsync()
    {
        for(let key in PGDBConnection._pools)
        {
            await PGDBConnection._pools[key].end();
        }
    }

    protected static async ClosePoolAsync(key: string)
    {
        if(!PGDBConnection._pools[key])
            return;

        await PGDBConnection._pools[key].end();
        
    }

    protected static StartPoolingIfNeeded(pgConnection: PGDBConnection)
    {
        if(!PGDBConnection._pools[pgConnection.GetConnectionIdentifier()])
        {
            PGDBConnection._pools[pgConnection.GetConnectionIdentifier()] = new pg.Pool({
                user: pgConnection.UserName,
                host: pgConnection.HostName,
                database : pgConnection.DataBaseName,
                port: pgConnection.Port,
                password: pgConnection.PassWord,
                min: pgConnection.MinPool, 
                max: pgConnection.MaxPool
            });            
        }
    }
    
    public AsPostgres() : PGDBConnection
    {        
        this.DataBaseName = "postgres";
        this.InPoolMode = false;
        return this;
    }
    
    public OpenAsync() : Promise<void>
    {

        return new Promise<void>(async (resolve, reject) => 
        {
            try
            {
                 if(this.IsOpen)
                    await this.CloseAsync();      
                
                if(this.InPoolMode)
                {
                    PGDBConnection.StartPoolingIfNeeded(this);

                    this._conn = await PGDBConnection._pools[this.GetConnectionIdentifier()]!.connect();

                }else
                {
                    
                    this._conn = new pg.Client({
                        host : this.HostName, 
                        port : this.Port, 
                        database : this.DataBaseName, 
                        user : this.UserName, 
                        password: this.PassWord
                    });                        
        
                    await this._conn.connect();
                }

                
               
                this.IsOpen = true;
                resolve();
    
            }catch(err)
            {                
                reject(new ConnectionFailException((err as Error).message));
            }   
        });      

    }

    public async BeginTransactionAsync() : Promise<void>
    {
        return new Promise<void>(async (resolve, reject) => 
        {
            try
            { 
                await this._conn.query("BEGIN")
                this._inTransactionMode = true;
                resolve();
                
            }catch(err)
            {
                reject(new QueryFailException((err as Error).message, "BEGIN"));
            }    
        });  
    }

    
     public async SavePointAsync(savepoint : string) : Promise<void>
    {       

        return new Promise<void>(async (resolve, reject) => 
        {
            try
            {
                 if(!savepoint || !savepoint.trim())
                   return reject( new InvalidOperationException("The name of savepoint is required"));        

                if(!this._inTransactionMode)
                    return reject(new InvalidOperationException(`Can not create a savepoint before start a transaction. Call the ${PGDBConnection.name}.${this.BeginTransactionAsync.name} method before`));

                await this._conn.query(`SAVEPOINT ${savepoint.toLowerCase()}`)

                resolve();
                
            }catch(err)
            {
                reject(new QueryFailException((err as Error).message, `SAVEPOINT ${savepoint.toLowerCase()}`));
            }    
        });  
    }


    public async CommitAsync() : Promise<void>
    {
        return new Promise<void>(async (resolve, reject) => 
        {
            try
            {         
                 if(!this._inTransactionMode)
                    return reject(new InvalidOperationException(`Can not do a commit before start a transaction. Call the ${PGDBConnection.name}.${this.BeginTransactionAsync.name} method before`));
                
                await this._conn.query("COMMIT")
                this._inTransactionMode = false;

                resolve();
                
            }catch(err)
            {
                reject(new QueryFailException((err as Error).message, "COMMIT"));
            }    
        });  
    }

    public async RollBackAsync(toSavePoint?: string) : Promise<void>
    {
        return new Promise<void>(async (resolve, reject) => 
        {
            try
            {
                if(!this._inTransactionMode)
                   return reject( new InvalidOperationException(`Can not do a rollback before start a transaction. Call the ${PGDBConnection.name}.${this.BeginTransactionAsync.name} method before`));

                let query = toSavePoint && toSavePoint.trim() ? `ROLLBACK TO SAVEPOINT ${toSavePoint}` : "ROLLBACK";
                await this._conn.query(query)
                resolve();

                if(!toSavePoint || !toSavePoint.trim())
                    this._inTransactionMode = false;
                
            }catch(err)
            {
                reject(new QueryFailException((err as Error).message, (toSavePoint && toSavePoint.trim() ? `ROLLBACK TO SAVEPOINT ${toSavePoint}` : "ROLLBACK")));
            }    
        });  
    }

    public QueryAsync(query : string) : Promise<any>
    {
        return new Promise<any>(async (resolve, reject) => 
        {
            try
            {
                resolve(await this._conn.query(query));
                
            }catch(err)
            {
                reject(new QueryFailException((err as Error).message, query));
            }    
        });  
        
        
    }

    public CloseAsync()
    {
        return new Promise<void>(async (resolve, reject) => 
        {
            try
            {
                if(!this.IsOpen || !this._conn)
                    return resolve();
                
                if(!this.InPoolMode && this._conn instanceof pg.Client)
                    await this._conn.end();
                else                
                    (this._conn as pg.PoolClient).release();
                
                this.DataBaseName = this._originalDatabase;
                this.InPoolMode = this._originalUsePoolMode;
                this.IsOpen = false;
                resolve();
                
            }catch(err)
            {
                reject(new ConnectionFailException((err as Error).message));
            }    
        });  
         
        
    }


    public async ExecuteNonQueryAsync(query: string): Promise<void> {
       
        return new Promise<void>(async (resolve, reject) => 
        {
            try
            {
                await this._conn.query(query)
                resolve();

            }catch(err)
            {
                reject(new QueryFailException((err as Error).message, query));
            }  
        });          

    }


    public async ExecuteAsync(query: string): Promise<any> {

        return new Promise<any>(async (resolve, reject) => 
        {
            try
            {
                resolve(await this._conn.query(query));

            }catch(err)
            {
                reject(new QueryFailException((err as Error).message, query));
            }  
        });  
    }
}