# Define required variables
variable "OpenSearchDomainEndpoint" {
    type = string
    description = "OpenSearch domain URL"
}

variable "IAMRoleARN" {
    type = string
    description = "IAM Role ARN to interact with OpenSearch"
}

# Define the OpenSearch provider
terraform {
  required_providers {
    opensearch = {
      source = "gnuletik/opensearch"
      version = "2.7.0"
    }
  }
}

# Configure the OpenSearch provider with the required domain endpoint URL and IAM role
provider "opensearch" {
  url = "https://${var.OpenSearchDomainEndpoint}"
  aws_assume_role_arn = "${var.IAMRoleARN}"
}

# Create an index template
resource "opensearch_index_template" "template_1" {
  name = "cicd_template_terraform"
  body = <<EOF
{
  "index_patterns": ["terraform_index_*"],
  "template": {
    "settings": {
      "number_of_shards": "1"
    },
    "mappings": {
        "_source": {
            "enabled": false
        },
        "properties": {
            "host_name": {
                "type": "keyword"
            },
            "created_at": {
                "type": "date",
                "format": "EEE MMM dd HH:mm:ss Z YYYY"
            }
        }
    }
  }
}
EOF
}