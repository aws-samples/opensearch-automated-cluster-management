#choose aws provider
provider "aws" {
  region = "us-east-2" # Replace with your desired AWS region
}

# Create an OpenSearch domain
resource "aws_opensearch_domain" "example" {
  domain_name = "example-domain"

  engine_version = "OpenSearch_2.11" # Replace with the desired OpenSearch version

  cluster_config {
    instance_type          = "r6g.large.search" # Replace with the desired instance type
    instance_count         = 2                  # Replace with the desired number of instances
    dedicated_master_enabled = true
    dedicated_master_count   = 3                # Replace with the desired number of dedicated master nodes
    dedicated_master_type    = "r6g.large.search" # Replace with the desired instance type for dedicated master nodes
    zone_awareness_enabled = true
    zone_awareness_config {
      availability_zone_count = 2 # Number of availability zones to use
    } # Replace with the desired number of availability zones
  }

  ebs_options {
    ebs_enabled = true
    volume_type = "gp3"
    volume_size = 32 # Replace with the desired EBS volume size in GB
  }

  encrypt_at_rest {
    enabled = true
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  advanced_security_options {
    enabled                        = true
    internal_user_database_enabled = true
    master_user_options {
      master_user_name     = "admin"
      master_user_password = "P@ssw0rd" # Replace with your desired password
    }
  }

  log_publishing_options {
    log_type                 = "INDEX_SLOW_LOGS"
    cloudwatch_log_group_arn = aws_cloudwatch_log_group.example.arn
  }

  tags = {
    Environment = "sandbox"
  }
}

resource "aws_cloudwatch_log_group" "example" {
  name              = "example-log-group"
  retention_in_days = 30 # Adjust the retention period as needed
}

resource "aws_cloudwatch_log_resource_policy" "example" {
  policy_name     = "example-policy"
  policy_document = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "es.amazonaws.com"
      },
      "Action": [
        "logs:PutLogEvents",
        "logs:CreateLogStream"
      ],
      "Resource": "${aws_cloudwatch_log_group.example.arn}:*"
    }
  ]
}
EOF
}