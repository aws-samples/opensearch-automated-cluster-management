from urllib.parse import urlparse
from os import environ

from boto3 import Session

from opensearchpy import OpenSearch, Urllib3AWSV4SignerAuth, Urllib3HttpConnection

def lambda_handler(event, context):
    opensearch_domain_endpoint = environ.get("OPENSEARCH_DOMAIN_ENDPOINT")
    url = urlparse(f"https://{opensearch_domain_endpoint}")
    region = environ.get("AWS_REGION")
    service = environ.get("SERVICE", "es")

    credentials = Session().get_credentials()

    auth = Urllib3AWSV4SignerAuth(credentials, region, service)

    client = OpenSearch(
        hosts=[{"host": url.netloc, "port": url.port or 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=Urllib3HttpConnection,
        timeout=30,
    )

    try:
        return client.indices.get_index_template("cicd*")
    except:
        return "No index patterns created by Terraform or Evolution"