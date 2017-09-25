import Model from './model.js'
import buildService from './service.js'
import queryView from './view.js'

export default class Db {
    constructor(config, tableData, views) {
        this.name = config.name
        this.config = config
        this._db = initDatabse(config)
        this._views = views
        this.models = {}
        this.tableData = tableData

        let tableNames = Object.keys(this.tableData)
        for (var i = 0; i < tableNames.length; i++) {
            let name = tableNames[i];
            this.models[name] = new Model(this, name, tableData[name])
        }
        Object.assign(this, this.models)
    }
    async initModels() {
        for (let m of Object.values(this.models)) {
            await m.initModel()
        }
        return this
    }

    getDb() {
        return this._db
    }
    queryView(name, whereObj) {
        let viewObj = name
        if (typeof name == 'string') {
            viewObj = this._views[name]
        }
        return queryView(this.getModel.bind(this), viewObj, whereObj)
    }
    getModel(name) {
        return this.models[name]
    }

    toService(fun) {
        return buildService(this.models, fun)
    }

    executeSql(sql, values, cb) {
        return new Promise((resolve, reject) => {
            this._db.transaction(function (tx) {
                let arrsql = []
                let arrvalues = []
                if (!Array.isArray(sql)) {
                    arrsql.push(sql)
                    arrvalues.push(values)
                } else {
                    arrsql = sql
                    arrvalues = values || []
                }
                let success = []
                let error = []
                arrsql.forEach((sql, index) => {
                    let values = arrvalues[index] || []
                    tx.executeSql(sql, values, (tx, rs) => {
                        console.log('sql:' + sql)
                        console.log('values:' + JSON.stringify(values))
                        console.log('影响行数:' + rs.rows.length)
                        success.push(Array.from(rs.rows || []))
                        if (index == arrsql.length - 1) {
                            callback(tx)
                        }
                    }, (tx, err) => {
                        console.log('sql:' + sql)
                        console.log('values:' + values.join(' , '))
                        console.log('出错信息:' + err.message)
                        error.push(err)
                        if (index == arrsql.length - 1) {
                            callback(tx)
                        }
                    });
                })
                const callback = (tx) => {
                    if (error.length > 0) {
                        reject(error.length == 1 ? error[0] : error, tx)
                    } else {
                        if (cb) {
                            cb(arrsql, success, tx)
                        }
                        resolve(success.length == 1 ? success[0] : success, tx)
                    }
                }
            });
        })
    }

    async createTable(name, fields) {
        fields = fields || ['id,code,name']
        let sql = ['create table if not exists ' + name + '(' + fields.join(',') + ')'];
        sql.push('select * from ' + name + ' limit 1 offset 0')
        await this.executeSql(sql, null, (sqls, values, tx) => {
            let data = values[1]
            if (data.length != 0) {
                let addFieldNames = fields.filter(f => !data[0].hasOwnProperty(f))
                let alterTableSql = []
                for (var i = 0; i < addFieldNames.length; i++) {
                    let f = addFieldNames[i];
                    tx.executeSql('alter table ' + name + ' add column ' + f)
                }
                // await this.executeSql(alterTableSql);
            } else {
                tx.executeSql('drop table ' + name)
                tx.executeSql(sql[0])
            }
        })
    }

}

function initDatabse(cfg) {
    cfg = cfg || {}
    cfg.name = cfg.name || 'mkormdb'
    cfg.version = cfg.version || ''
    cfg.desc = cfg.desc || 'created by mk-orm'
    cfg.size = cfg.size || 5 * 1024 * 1024
    return window.openDatabase(cfg.name, cfg.version, cfg.desc, cfg.size);
}