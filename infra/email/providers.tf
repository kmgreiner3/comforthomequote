terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
  backend "s3" {
    bucket  = "chq-tfstate-984950935097"
    key     = "email/terraform.tfstate"
    region  = "us-east-1"
    profile = "chq-comforthomequote"
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "chq-comforthomequote"
  default_tags {
    tags = {
      project    = "comforthomequote"
      managed_by = "terraform"
      stack      = "email"
    }
  }
}

# Management account -- Route53 zone only. Never create other resources here.
provider "aws" {
  alias   = "management"
  region  = "us-east-1"
  profile = "chq-management"
}
