export default function constructor(config, tableData, views) {
    this.name = config.name
    this.config = config
    this.db = initDatabse(config)
    this.views = views
    this.models = {
        toService,
        db: () => this.db,
        views: (name) => this.views[name],
        config,
        executeSql,
        initModelByData,
        crateTable
    }
    let tableNames = Object.keys(tableData)
    for (var i = 0; i < tableNames.length; i++) {
        let name = tableNames[i];
        this.models[name] = this.models.initModelByData(name, tableData[name])
    }
    return this.models
}

const initDatabse = (cfg) => {
    cfg = cfg || {}
    cfg.name = cfg.name || 'mkormdb'
    cfg.version = cfg.version || ''
    cfg.desc = cfg.desc || 'created by mk-orm'
    cfg.size = cfg.size || 10 * 1024 * 1024
    return window.openDatabase(cfg.name, cfg.version, cfg.desc, cfg.size);
}

function initModelByData(name, data) {
    let model = Object.assign({ models: this, name, _fields: Object.keys(data[0]) }, modelCls)
    //create table
    this.crateTable(name, model._fields).then(() => {
        data.forEach(d => {
            //delete insert data 
            model.delete({ id: d.id }, d)
        })
    })

    return model
}

function errorCallback() {
    console.log('db error:' + arguments)
}

async function crateTable(name, fields) {
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
            debugger
            tx.executeSql('drop table ' + name)
            tx.executeSql(sql[0])
        }
    })
}
// let v = {
//     fields: '*',
//     menuOperationList: {
//         name: 'menuOperation',
//         fields: '*',
//         where: {
//             menuId: '$id',
//             roleId: 0
//         }
//     }
// }
const modelCls = {
    view: async function (viewName, whereObj) {
        viewName = viewName || this.name
        if (typeof viewName == 'object') {
            whereObj = viewName
            viewName = this.name
        }
        let parentWhereObj = whereObj && whereObj.where || whereObj || {}
        let view = this.models.views(viewName)
        let values = await this.query({ fields: view.fields, where: parentWhereObj })


        for (let i = 0; i < values.length; i++) {
            let obj = values[i];
            let subObjects = Object.keys(view).filter(k => k != 'fields')
            for (var j = 0; j < subObjects.length; j++) {
                var subObjKey = subObjects[j];
                let { name, fields, where } = view[subObjKey]
                let curWhere = Object.assign({}, where)
                Object.keys(curWhere).forEach(whereItem => {
                    let whereValue = curWhere[whereItem]
                    if (whereValue && whereValue.indexOf && whereValue.indexOf('$') == 0) {
                        let relateField = whereValue.substr(1)
                        let fieldPaths = relateField.split('.')
                        if (fieldPaths[0] == 'where') {
                            curWhere[whereItem] = whereObj[fieldPaths[1]]
                        } else {
                            curWhere[whereItem] = obj[fieldPaths[1] || fieldPaths[0]]
                        }
                    }
                })
                let theValue = await this.models[name].query({ fields: fields, where: curWhere })
                obj[subObjKey] = theValue
            }
        }

        return values
    },
    query: async function (options) {
        let whereObj = options && options.where || options || {}
        let whereSqlObj = getWhereSql(whereObj)
        let fields = options && options.fields || '*'
        let sql = 'SELECT ' + fields + ' FROM ' + this.name + whereSqlObj.where + ';';
        let result = await this.models.executeSql(sql, whereSqlObj.values)
        return result
    },
    create: async function (obj) {
        let keys = Object.keys(obj)
        let values = Object.values(obj)
        let sql = 'INSERT INTO ' + this.name + ' (' + keys.join(',') + ') VALUES (' + keys.map(i => '?').join(',') + ');';
        let result = await this.models.executeSql(sql, values)
        return result
    },
    update: async function (values, options) {
        let whereObj = options && options.where || values && values.id && { id: values.id } || { '1': '1' }
        let setFields = Object.keys(values)
        let where = ' where ' + Object.keys(whereObj).map(k => k + " = ?").join(' and ')
        let set = ' set ' + setFields.map(k => k + ' = ?').join(', ')
        let arrValues = Object.values(values).concat(Object.values(whereObj))
        var sql = 'UPDATE ' + this.name + set + where + ';';
        let result = await this.models.executeSql(sql, arrValues)
        return result
    },
    delete: async function (obj, insertObj) {
        if (!obj) {
            return
        }
        let whereSqlObj = getWhereSql(obj)
        let values = whereSqlObj.values
        var sql = 'DELETE FROM ' + this.name + whereSqlObj.where + ';';
        if (insertObj) {
            sql = [sql]
            let keys = Object.keys(insertObj)
            let insertSql = 'INSERT INTO ' + this.name + ' (' + keys.join(',') + ') VALUES (' + keys.map(i => '?').join(',') + ');';
            sql.push(insertSql)
            values = [values, Object.values(insertObj)]
        }
        let result = await this.models.executeSql(sql, values)
        return result
    },
    queryPage: function () {
    },
    createBatch: function () {
    },
    updateBatch: function () {
    },
    deleteBatch: function () {
    },
}
function getWhereSql(obj) {
    let whereObj = obj && obj.where || obj || {}
    let values = []
    let keys = Object.keys(whereObj)
    let where = ' WHERE ' + keys.map(k => {
        let value = whereObj[k]
        if (Array.isArray(value)) {
            return '(' + value.map(sw => {
                values.push(sw)
                return k + ' = ? '
            }).join(' or ') + ')'
        } else {
            values.push(value)
            return k + ' = ? '
        }
    }).join(' and ');
    if (keys.length == 0) where = ''
    return { where, values }
}

function executeSql(sql, values, cb) {
    return new Promise((resolve, reject) => {
        this.db().transaction(function (tx) {
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
function toService(extendFun) {
    let models = this
    let modelServices = serviceWrapper(models)
    let extendServices = serviceWrapper(extendFun && extendFun(models), modelServices)
    return modelServices
}
function serviceWrapper(services, server) {
    server = server || {}
    services = services || {}
    Object.keys(services).forEach(key => {
        let obj = services[key]
        if (!obj || typeof obj != 'object') return;
        let service = server[key] || {}
        Object.keys(obj).forEach(name => {
            let fun = obj[name]
            if (!fun || typeof fun != 'function') return;
            service[name] = async function (data, headers) {
                // console.log(name + ':' + arguments)
                try {
                    let ctx = headers || {}
                    if (ctx.token && typeof ctx.token == "string") {
                        let token = { userId: Number(ctx.token.split(',')[0] || '') }
                        ctx.token = token
                    }
                    let value = await obj[name](data, ctx)
                    return { result: true, value }
                } catch (error) {
                    return { result: false, error }
                }
            }
        })
        server[key] = service
    })
    return server
}
