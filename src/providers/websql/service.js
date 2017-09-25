

export default function toService(models, extendFun) {
    let modelServices = serviceWrapper(models)
    let allServices = serviceWrapper(extendFun && extendFun(models), modelServices)
    return allServices
}
// let services = {
//     user: {
//         login: (data, ctx) => {
//             console.log(data)
//         }
//     }
// }
function serviceWrapper(services, server) {
    server = server || {}
    services = services || {}
    Object.keys(services).forEach(key => {
        let obj = services[key]
        if (!obj || typeof obj != 'object') return;
        let serviceObj = server[key] || {}
        let serviceNames = getObjMethods(obj)
        serviceNames.forEach(name => {
            let fun = obj[name]
            if (!fun || typeof fun != 'function') return;
            let serviceFunction = fun.bind(obj)
            serviceObj[name] = async function (data, headers) {
                // console.log(name + ':' + arguments)
                try {
                    let ctx = headers || {}
                    if (ctx.token && typeof ctx.token == "string") {
                        let token = { userId: Number(ctx.token.split(',')[0] || '') }
                        ctx.token = token
                    }
                    let value = await serviceFunction(data, ctx)
                    return { result: true, value }
                } catch (error) {
                    return { result: false, error }
                }
            }
        })
        server[key] = serviceObj
    })
    return server
}
function getObjMethods(obj, methods = []) {
    let proto = Object.getPrototypeOf(obj)
    let curMethods = Object.getOwnPropertyNames(obj).filter(n => typeof obj[n] == 'function' && n != 'constructor')
    methods = [...methods, ...curMethods]
    if (proto.constructor && proto.constructor.name != 'Object') {
        return getObjMethods(proto, methods)
    } else {
        return methods
    }
}