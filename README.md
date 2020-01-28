# Consul ACL policy & token bootstrapping tool
## Conceptual usage
1. Declare an environment with the following variables  
    ```
    export CONSUL_MANAGEMENT_TOKEN_SECRET_ID=$(uuidgen)
    export CONSUL_TOKEN_ACCESSOR_ID=$(genuuid)
    export CONSUL_TOKEN_SECRET_ID=$(genuuid)
    export CONSUL_POLICY_NAME="untitled-policy"
    export CONSUL_ACL_DESCRIPTION="Untitled policy for untitled Consul service"
    export CONSUL_POLICY_PATH="$(pwd)/untitledpolicy.hcl"
    export CONSUL_HOST=127.0.0.1
    export CONSUL_DATACENTER=dc1
    ```

2. Execute the tool  
3. The cluster now has the token with the provided policy  
