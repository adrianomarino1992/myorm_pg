import { Column } from "../../src/Index";



export default class EntityWithNoKey {

    @Column()
    public Id: number = -1;

    @Column()
    public Name: string = "";
}
