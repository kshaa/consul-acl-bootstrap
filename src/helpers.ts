import fetch from 'node-fetch'
import {
    ConsulConsensusResult,
    ConsulNode,
    EnhancedConsulNode,
    ConsulNodeType,
    AgentPolicyResponse,
    AgentTokenResponse
} from './types'

export function createConsulApiAddress(
    consulScheme : string,
    consulHost : string,
    consulPort : string
) : string {
    return `${consulScheme}://${consulHost}:${consulPort}`
}

export async function getClusterConsensus(
    consulApi : string,
    consulDatacenter : string,
    consulAclToken : string
) : Promise<ConsulConsensusResult> {
    const apiReachError = 'Can\'t reach Consul API'
    await fetch(`${consulApi}`, { headers: { 'X-Consul-Token': consulAclToken } })
        .then(res => {
            if (!res.ok) throw Error(apiReachError)
        })
        .catch(err => {
            throw Error(apiReachError)
        })
    
    const leaderDeclarationError = 'Leader not declared yet'
    const leaderIP : string = await fetch(
        `${consulApi}/v1/status/leader?dc=${encodeURIComponent(consulDatacenter)}`,
        { headers: { 'X-Consul-Token': consulAclToken } }
    )
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
    const peerIPs = await fetch(
        `${consulApi}/v1/status/peers?dc=${encodeURIComponent(consulDatacenter)}`,
        { headers: { 'X-Consul-Token': consulAclToken } }
    )
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
    consulApi : string,
    consulDatacenter : string,
    consulAclToken : string,
    consensusCheckTimeout : number
) : Promise<ConsulConsensusResult> {
    var clusterConsensusResult = null
    do {
        try {
            clusterConsensusResult = await getClusterConsensus(
                consulApi,
                consulDatacenter,
                consulAclToken
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
    consulAclToken : string,
    clusterConsensus : ConsulConsensusResult
) : Promise<Array<EnhancedConsulNode>> {
    const consulApi = createConsulApiAddress(consulScheme, consulHost, consulPort)
    const nodes : Array<ConsulNode> = await fetch(
        `${consulApi}/v1/catalog/nodes?dc=${encodeURIComponent(consulDatacenter)}`,
        { headers: { 'X-Consul-Token': consulAclToken } }
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

export async function createAgentPolicy(
    consulApi : string,
    consulDatacenter : string,
    consulAclToken : string
) : Promise<AgentPolicyResponse> {
    const agentPolicy = {
        Name: 'agent',
        Description:
            'Grants read/write access to all node information & ' +
            'read access to all service information',
        Rules: `
            node_prefix "" {
                policy = "write"
            }
            service_prefix "" {
                policy = "read"
            }
        `,
        Datacenters: [ consulDatacenter ]
    }
 
    return await fetch(`${consulApi}/v1/acl/policy`, {
        method: 'PUT',
        body:    JSON.stringify(agentPolicy),
        headers: {
            'Content-Type': 'application/json',
            'X-Consul-Token': consulAclToken
        },
    })
        .then(res => {
            if (!res.ok) throw Error(
                `API Response status: ${res.statusText}`
            )
            return res.json()
        })
        .catch(err => {
            throw Error(
                `Failed to create an agent policy. ` +
                `Reason: ${err.message}`
            )
        });
}

export async function createAgentToken(
    consulApi : string,
    consulAclToken : string,
    agentPolicy : AgentPolicyResponse
) : Promise<AgentTokenResponse> {
    const agentToken = {
        Description:
            'Token for cluster agents',
        Policies: [ agentPolicy.ID ]
    }
 
    return await fetch(`${consulApi}/v1/acl/token`, {
        method: 'PUT',
        body:    JSON.stringify(agentToken),
        headers: { 
            'Content-Type': 'application/json',
            'X-Consul-Token': consulAclToken
        },
    })
        .then(res => {
            if (!res.ok) throw Error(
                `API Response status: ${res.statusText}`
            )
            return res.json()
        })
        .then(json => json)
        .catch(err => {
            throw Error(
                `Failed to create agent token ` +
                `Reason: ${err.message}`
            )
        });
}

export async function assignAgentTokens(
    consulAclToken : string,
    consulNodes : Array<EnhancedConsulNode>,
    agentToken : AgentTokenResponse
) {
    for (let node of consulNodes) {
        let agentTokenAttachment = {
            Token: agentToken.SecretID
        }
    
        return await fetch(`${node.apiAddress}/v1/agent/token/agent`, {
            method: 'PUT',
            body:    JSON.stringify(agentTokenAttachment),
            headers: { 
                'Content-Type': 'application/json',
                'X-Consul-Token': consulAclToken
            },
        })
            .then(res => {
                if (!res.ok) throw Error(
                    `API Response status: ${res.statusText}`
                )
                return res.json()
            })
            .then(json => json)
            .catch(err => {
                throw Error(
                    `Failed to assign agent token ` +
                    `Reason: ${err.message}`
                )
            });    
    }
}
