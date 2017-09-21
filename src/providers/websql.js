function constructor(config, tableData) {
    this.name = config.name
    this.config = config
    this.db = initDatabse(config)
    this.models = {
        toService,
        db: () => this.db,
        config,
        executeSql,
        initModelByData,
        crateTable
    }
    Object.keys(tableData).forEach(name => {
        this.models[name] = this.models.initModelByData(name, tableData[name])
    })
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
    this.crateTable(name, model._fields)
    //insert data 
    data.forEach(d => model.delete(d))
    data.forEach(d => model.create(d))

    return model
}

function errorCallback() {
    console.log('db error:' + arguments)
}

function crateTable(name, fields) {
    fields = fields || ['id,code,name']
    var sql = 'create table if not exists ' + name + '(' + fields.join(',') + ')';
    this.executeSql(sql)
}

const modelCls = {
    query: async function (obj) {
        obj = obj || {}
        let where = ' where ' + Object.keys(obj).map(k => k + " = ?").join(' and ')
        let values = Object.values(obj)
        let sql = 'SELECT * FROM ' + this.name + ';';
        let result = await this.models.executeSql(sql, values)
        return result
    },
    create: async function (obj) {
        let keys = Object.keys(obj)
        let values = Object.values(obj)
        let sql = 'INSERT INTO ' + this.name + ' (' + keys.join(',') + ') VALUES (' + keys.map(i => '?').join(',') + ');';
        let result = await this.models.executeSql(sql, values)
        return result
    },
    update: async function (obj, whereObj) {
        obj = obj || {}
        if (!obj.id && !whereObj) {
            return
        }
        whereObj = whereObj || {}
        let where = ' where ' + Object.keys(whereObj).map(k => k + " = ?").join(' and ')
        let set = ' set ' + Object.keys(obj).map(k => k + ' = ?').join(', ')
        let values = Object.value(obj).concat(Object.values(whereObj))
        var sql = 'UPDATE ' + this.name + set + where + ';';
        let result = await this.models.executeSql(sql, values)
        return result
    },
    delete: async function (obj) {
        if (!obj) {
            return
        }
        let where = Object.keys(obj).map(k => k + " = ?").join(' and ')
        let values = Object.values(obj)
        var sql = 'DELETE FROM ' + this.name + ' WHERE ' + where + ';';
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
function executeSql(sql, values) {
    return new Promise((resolve, reject) => {
        this.db().transaction(function (tx) {
            tx.executeSql(sql, values, (tx, rs) => {
                console.log('sql:' + sql)
                console.log('影响行数:' + rs.rows.length)
                resolve(Array.from(rs.rows || []))
            }, (tx, err) => {
                console.log('sql:' + sql)
                console.log('出错信息:' + err.message)
                reject(err)
            });
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
            service[name] = async function () { 
                // console.log(name + ':' + arguments)
                try {
                    let value = await obj[name](...arguments)
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

module.exports = constructor