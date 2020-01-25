import fetch from 'node-fetch'
import { ConsulConsensusResult, ConsulNode, EnhancedConsulNode, ConsulNodeType } from './types'

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
        .then(res => res.json())
        .then(res => {
            if (typeof(res) !== 'string') throw Error(leaderDeclarationError)
            if (res == '' ) throw Error(leaderDeclarationError)
            return res.replace(/\:.*/g, '') // Remove port from node address
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

            return res.map(address => address.replace(/\:.*/g, '')) // Remove port from node address
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
    var clusterConsensusResult = null
    do {
        try {
            clusterConsensusResult = await getClusterConsensus(
                consulScheme,
                consulHost,
                consulPort,
                consulDatacenter
            )
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
    } while (clusterConsensusResult === null)

    return clusterConsensusResult
}

export async function findConsulNodes(
    consulScheme : string,
    consulHost : string,
    consulPort : string,
    consulDatacenter : string,
    clusterConsensus : ConsulConsensusResult
) : Promise<Array<EnhancedConsulNode>> {
    const consulApi = createConsulApiAddress(consulScheme, consulHost, consulPort)
    const nodes : Array<ConsulNode> = await fetch(
        `${consulApi}/v1/catalog/nodes?dc=${encodeURIComponent(consulDatacenter)}`
    ).then(res => res.json())
    const enhancedNodes : Array<EnhancedConsulNode> = []
    for (let node of nodes) {
        var type : ConsulNodeType = ConsulNodeType.Unknown 
        if (node.Address === clusterConsensus.leaderIP) {
            type = ConsulNodeType.Master
        } else if (clusterConsensus.peerIPs.includes(node.Address)) {
            type = ConsulNodeType.Slave
        }
        let apiAddress = createConsulApiAddress(
            consulScheme,
            node.Address,
            consulPort
        )
        enhancedNodes.push({
            ...node,
            type,
            apiAddress
        } as EnhancedConsulNode)
    }

    return enhancedNodes
}

