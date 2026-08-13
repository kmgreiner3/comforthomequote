terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {
    bucket  = "chq-tfstate-984950935097"
    key     = "ci/terraform.tfstate"
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
      stack      = "ci"
    }
  }
}
