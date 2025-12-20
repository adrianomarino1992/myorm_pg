import { PGDBManager, PGDBContext, PGDBSet} from '../../src/Index';

import EntityWithNoKey from  './EntityWithNoKey';

export default class ErrorContext extends PGDBContext {

    public ErrorEntity: PGDBSet<EntityWithNoKey>;

    constructor(manager: PGDBManager) {
        super(manager);

        this.ErrorEntity = new PGDBSet(EntityWithNoKey, this);
    }
}
