import fetch from 'node-fetch'
import { ConsulConsensusResult, ConsulNode, TypedConsulNode } from './types'

export function createConsulApiAddress(
    consulScheme : string,
    consulHost : string,
    consulPort : string
) : string {
    return `${consulScheme}://${consulHost}:${consulPort}`
}

export async function getClusterConsensus(
    consulScheme : string,
    consulHost : string,
    consulPort : string,
    consulDatacenter : string
) : Promise<ConsulConsensusResult> {
    const consulApi = createConsulApiAddress(consulScheme, consulHost, consulPort)

    const apiReachError = 'Can\'t reach Consul API'
    await fetch(`${consulApi}`)
        .then(res => {
            if (!res.ok) throw Error(apiReachError)
        })
        .catch(err => {
            throw Error(apiReachError)
        })
    
    const leaderDeclarationError = 'Leader not declared yet'
    const leaderIP : string = await fetch(`${consulApi}/v1/status/leader?dc=${encodeURIComponent(consulDatacenter)}`)
        .then(res => res.text())
        .then(res => {
            if (typeof(res) !== 'string') throw Error(leaderDeclarationError)
            if (res == '' ) throw Error(leaderDeclarationError)
            return res
        })
        .catch(err => {
            throw Error(leaderDeclarationError)
        })
    
    const peerDeclarationError = 'Peers not declared yet'
    const peerIPs = await fetch(`${consulApi}/v1/status/peers?dc=${encodeURIComponent(consulDatacenter)}`)
        .then(res => res.json())
        .then(res => {
            if (typeof(res) !== 'object') throw Error(peerDeclarationError)
            if (res.length == 0) throw Error(peerDeclarationError)
            return res
        })
        .catch(err => {
            throw Error('Peers not declared yet')
        })

    return {
        leaderIP,
        peerIPs
    } as ConsulConsensusResult
}

export async function reachClusterConsensus(
    consulScheme : string,
    consulHost : string,
    consulPort : string,
    consulDatacenter : string,
    consensusCheckTimeout : number
) : Promise<ConsulConsensusResult> {
    var consensusReached = false
    var clusterConsensusResult
    do {
        try {
            clusterConsensusResult = await getClusterConsensus(
                consulScheme,
                consulHost,
                consulPort,
                consulDatacenter
            ).then(res => {
                consensusReached = true
            })
        } catch (error) {
            console.log(
                `Consul cluster hasn't reached a consensus yet. ` +
                `Reason: '${error.message}'. ` +
                `Waiting for ${consensusCheckTimeout} miliseconds until next check.`
            )

            await new Promise((resolve) => {
                setTimeout(resolve, consensusCheckTimeout)
            }) 
        }
    } while(!consensusReached)
    return clusterConsensusResult
}

// export async function findConsulAgents(
//     consulScheme : string,
//     consulHost : string,
//     consulPort : string,
//     consulDatacenter : string,
//     clusterConsensus : ConsulConsensusResult
// ) : Array<TypedConsulNode> {
//     const consulApi = createConsulApiAddress(consulScheme, consulHost, consulPort)
//     const nodes : Array<ConsulNode> = await fetch(`${consulApi}/v1/catalog/nodes`)
//         .then(res => res.json())

//     // Implement exception handling
//     // Create typed consul node array
//     return []
// }

