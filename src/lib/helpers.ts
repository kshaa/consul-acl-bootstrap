export function createConsulApiAddress(
    consulScheme : string,
    consulHost : string,
    consulPort : string
) : string {
    return `${consulScheme}://${consulHost}:${consulPort}`
}

export async function repeatUntilSuccess(
    functionDescription : string,
    repeatTimeoutMilliseconds : number,
    callback : () => any
) {
    var oldErrorMessage = null
    var newErrorMessage = null
    var callbackResult = null
    do {
        try {
            callbackResult = await callback()
        } catch (error) {
            newErrorMessage = error.message
            if (newErrorMessage != oldErrorMessage) {
                console.log(
                    `Failed to run function "${functionDescription}". ` +
                    `Reason: '${error.message}'. ` +
                    `Will quietly retry every ${repeatTimeoutMilliseconds} miliseconds until there's a change.`
                )
            }
            oldErrorMessage = newErrorMessage

            await new Promise((resolve) => {
                setTimeout(resolve, repeatTimeoutMilliseconds)
            }) 
        }
    } while (callbackResult === null)
    console.log(`Successfully ran function "${functionDescription}"`)

    return callbackResult
}
