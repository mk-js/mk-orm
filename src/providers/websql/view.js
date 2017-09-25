
// let viewObj = {
//     name:'menu',
//     fields: '*',
//     menuOperationList: {
//         name: 'menuOperation',
//         fields: '*',
//         where: {
//             menuId: '$id',
//             roleId: '$args.roleIds',
//         }
//     }
// } 
export default async function view(getModel, viewObj, whereObj) {
    let parentWhereObj = whereObj && whereObj.where || whereObj || {}
    let orderBy = whereObj && whereObj.orderBy || {}
    let args = whereObj && whereObj.args || whereObj || {}
    let model = getModel(viewObj.name)
    let values = await model.query({ fields: viewObj.fields, where: parentWhereObj, orderBy })

    for (let i = 0; i < values.length; i++) {
        let obj = values[i];
        let subObjects = Object.keys(viewObj).filter(k => k && typeof k == 'object')
        for (var j = 0; j < subObjects.length; j++) {
            var subObjKey = subObjects[j];
            let { name, fields, where } = viewObj[subObjKey]
            let curWhere = Object.assign({}, where)
            Object.keys(curWhere).forEach(whereItem => {
                let whereValue = curWhere[whereItem]
                if (whereValue && whereValue.indexOf && whereValue.indexOf('$') == 0) {
                    let relateField = whereValue.substr(1)
                    let fieldPaths = relateField.split('.')
                    if (fieldPaths[0] == 'args') {
                        curWhere[whereItem] = args[fieldPaths[1]]
                    } else {
                        curWhere[whereItem] = obj[fieldPaths[1] || fieldPaths[0]]
                    }
                }
            })
            let theValue = await getModel(name).query({ fields: fields, where: curWhere })
            obj[subObjKey] = theValue
        }
    }

    return values
}