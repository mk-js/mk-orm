import config from './../config'
const { dbProvider, dbConfig, webProvider } = config.current
const models = dbProvider && new dbProvider(
    dbConfig,
    {
        role: [
            { id: 10, name: '管理员' },
            { id: 10, name: '管理员' },
            { id: 20, name: '用户' },
        ],
        menu: [
            { id: 20, name: '个人设置' },
            { id: 20, name: '个人设置' },
            { id: 21, name: '用户管理' },
        ],
        operation: [
            { id: 100, name: '查看', dependentId: null },
            { id: 900, name: '操作', dependentId: 100 },
        ],
        menuOperation: [
            { id: 1000, menuId: 21, operationId: 100, roleId: 0 },
            { id: 1001, menuId: 21, operationId: 900, roleId: 0 },
            { id: 1002, menuId: 20, operationId: 100, roleId: 0 },
            { id: 1003, menuId: 20, operationId: 900, roleId: 0 },
            { id: 1004, menuId: 21, operationId: 100, roleId: 10 },
            { id: 1005, menuId: 21, operationId: 900, roleId: 10 },
            { id: 1006, menuId: 20, operationId: 100, roleId: 10 },
            { id: 1007, menuId: 20, operationId: 900, roleId: 10 },
            { id: 1008, menuId: 21, operationId: 100, roleId: 20 },
            { id: 1009, menuId: 21, operationId: 900, roleId: 20 },
            { id: 1010, menuId: 20, operationId: 100, roleId: 20 },
            { id: 1011, menuId: 20, operationId: 900, roleId: 20 },
        ]
    }, {
        menuView: {
            fields: '*',
            menuOperationList: {
                name: 'menuOperation',
                fields: '*',
                where: {
                    menuId: '$id',
                    roleId: 0
                }
            }
        }
    })

let myServiceDefine = (models) => ({
    role: {
        init: async () => {
            return {
                roles: await models.role.query(),
                operations: await models.operation.query(),
                menus: await models.menu.view('menuView', {}),
                menuOperations: await models.menuOperation.query(),
            }
        }
    }
})

let service = models && models.toService(myServiceDefine)

webProvider && webProvider({
    '/v1/role/init': service.role.init,
    '/v1/role/query': service.role.query,
    '/v1/role/delete': service.role.delete,
    '/v1/menuOperation/*': service.menuOperation,
    // '/v1/*/*': service,
})