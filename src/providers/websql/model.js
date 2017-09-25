export default class Model {
    constructor(db, name, data) {
        this.name = name
        this.tableData = data

        this._db = db
        this._fields = Object.keys(data[0])

    }

    executeSql(...args) {
        return this._db.executeSql(...args)
    }

    async initModel() {
        await this._db.createTable(this.name, this._fields)
        for (let d of this.tableData) {
            //delete insert data 
            await this.delete({ id: d.id }, d)
        }
    }

    view(name, whereObj) {
        if (typeof name == 'object' && whereObj == undefined) {
            whereObj = name
            name = this.name
        }
        return this._db.queryView(name, whereObj)
    }

    async query(options) {
        let whereObj = options && options.where || options || {}
        let orderBy = options && options.orderBy || {}
        let whereSqlObj = getWhereSql(whereObj)
        let orderByString = getOrderByString(orderBy)
        let fields = options && options.fields || '*'
        let sql = 'SELECT ' + fields + ' FROM ' + this.name + whereSqlObj.where + orderByString + ';';
        let result = await this.executeSql(sql, whereSqlObj.values)
        return result
    }

    async create(obj) {
        let keys = Object.keys(obj)
        let values = Object.values(obj)
        let sql = 'INSERT INTO ' + this.name + ' (' + keys.join(',') + ') VALUES (' + keys.map(i => '?').join(',') + ');';
        let result = await this.executeSql(sql, values)
        return result
    }

    async update(values, options) {
        let whereObj = options && options.where || values && values.id && { id: values.id } || { '1': '1' }
        let setFields = Object.keys(values)
        let where = ' where ' + Object.keys(whereObj).map(k => k + " = ?").join(' and ')
        let set = ' set ' + setFields.map(k => k + ' = ?').join(', ')
        let arrValues = Object.values(values).concat(Object.values(whereObj))
        var sql = 'UPDATE ' + this.name + set + where + ';';
        let result = await this.executeSql(sql, arrValues)
        return result
    }

    async delete(obj, insertObj) {
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
        let result = await this.executeSql(sql, values)
        return result
    }

    queryPage() {
    }

    createBatch() {
    }

    updateBatch() {
    }

    deleteBatch() {
    }
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
function getOrderByString(orderBy) {
    let str = []
    let keys = Object.keys(orderBy)
    if (keys.length == 0) return ''
    keys.forEach(k => {
        str.push(k + ' ' + (orderBy[k] || 'asc'))
    })
    return ' order by ' + str.join(',')
}