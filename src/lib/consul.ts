import fetch from 'node-fetch'
import { createConsulApiAddress } from './helpers'
import {
    ConsulConsensusResult,
    ConsulNode,
    EnhancedConsulNode,
    ConsulNodeType,
    AgentPolicyResponse,
    AgentTokenResponse,
    AgentToken,
    AlreadyExistsError
} from './types'

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

export async function getConsulNodes(
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
    // Check if policy exists
    const agentPolicies = await fetch(`${consulApi}/v1/acl/policies`, {
        method: 'GET',
        headers: { 'X-Consul-Token': consulAclToken }
    })
        .then(res => {
            if (!res.ok) throw Error(
                `API Response status: ${res.statusText}`
            )
            return res.json()
        })
        .catch(err => {
            throw Error(
                `Failed to check agent policy state. ` +
                `Reason: ${err.message}`
            )
        })

    // If already exists return
    for (let policy of agentPolicies) {
        if (policy["Name"] === "agent") {
            return policy
        }
    }

    // Create policy
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
    tokenAccessorId : string | null,
    tokenSecretId : string | null,
    agentPolicy : AgentPolicyResponse
) : Promise<AgentTokenResponse> {
    if (tokenAccessorId !== null) {
        // Check if token exists
        const allTokens = await fetch(`${consulApi}/v1/acl/tokens`, {
            method: 'GET',
            headers: { 'X-Consul-Token': consulAclToken }
        })
            .then(res => {
                if (!res.ok) throw Error(
                    `API Response status: ${res.statusText}`
                )
                return res.json()
            })
            .catch(err => {
                throw Error(
                    `Failed to check agent token state. ` +
                    `Reason: ${err.message}`
                )
            })

        // If already exists return
        for (let token of allTokens) {
            if (token["AccessorID"] === tokenAccessorId) {
                return token
            }
        }
    }
    
    // Create token
    var agentToken : AgentToken = {
        Description:
            'Token for cluster agents',
        Policies: [
            { ID: agentPolicy.ID }
        ]
    }
    
    if (tokenSecretId !== null) {
        agentToken.SecretID = tokenSecretId
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
