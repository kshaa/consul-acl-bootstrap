export interface ConsulConsensusResult {
    leaderIP: string
    peerIPs: Array<string>
}

export interface ConsulNode {
    ID: string
    Node: string
    Address: string
}

export enum ConsulNodeType {
    Master = 'master',
    Slave = 'slave',
    Unknown = 'unknown'
}

export interface EnhancedConsulNode extends ConsulNode {
    type: ConsulNodeType
    apiAddress: string 
}

export interface AgentPolicyResponse {
    ID : string
    Name : string
    Description : string
}

export interface AgentPolicyMap {
    ID? : string
    Name? : string
}
export interface AgentToken {
    Description : string
    Policies : Array<AgentPolicyMap>
    SecretID? : string
    AccessorID? : string
}

export interface AgentTokenResponse {
    AccessorID : string
    SecretID : string
    Description : string
}

export class AlreadyExistsError extends Error {}