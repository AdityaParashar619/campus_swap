# CampusSwap faculty demo on AWS

The existing us-east-1 EC2 instance uses Docker Compose with loopback app access, Nginx with a trusted IP certificate, and an external Atlas Free database. Use the existing host Terraform state. A fresh apply of the root directory would propose another host. The Compose and Nginx files illustrate the existing faculty configuration. CD updates only the app image and container log settings through a Compose override.

Keep the existing mode-0600 /opt/campusswap/runtime.env on the host. It contains the private Gmail, Atlas and Cloudinary runtime configuration. Preserve domain-wide SATI registration, the faculty Cloudinary namespace, real accounts and content. Bootstrap, seeding and private evidence stay disabled. Keep Atlas access bound to the host IPv4 /32 and preserve the existing Certbot timer and ACME webroot. The CD state needs only the AWS account and instance identifiers.

## Enable after approval

1. Publish and merge the 11-file CD PR after normal CI. Protect main and changes to deployment workflows through required CI and review controls. Create the public repository environment campusswap-demo. Select the exact branch main under deployment branches and tags, with no tag rule. Add one trusted required reviewer with self-review prevention when a second maintainer is available. If operating alone, use maintainer-only dispatch and approve the absence of an independent reviewer explicitly. Keep administrator bypass disabled when using required reviewers.
2. Use a separate private state for ops/aws-demo/cd. Set TF_VAR_aws_account_id and TF_VAR_instance_id from the existing authenticated AWS session and host state without printing them. Initialize, then run terraform plan -var=create_github_oidc_provider=true -out=cd.tfplan if the provider remains absent. Review an add-only plan for the AWS IAM OIDC provider, deployment role, inline role policy and custom SSM Session document. If the provider already exists and admits sts.amazonaws.com, reuse it and expect three additions. Apply the reviewed saved CD plan only. The root host stack is outside this approval.
3. In the GitHub environment add variables AWS_ACCOUNT_ID, AWS_ROLE_ARN and AWS_INSTANCE_ID from the reviewed AWS settings. The workflow receives a 15-minute OIDC session. IAM checks the canonical repository ID, exact default environment subject, main ref, environment and workflow name. The role can start only CampusSwapDeployDemo on the existing instance and open or terminate its own session. It cannot launch an ordinary shell, run general SSM commands, access Secrets Manager, modify IAM or provision infrastructure. Maintain the GitHub environment allowlist and review protections independently of AWS.
4. For first activation, dispatch the deployment workflow from main with release run 45886722396. The workflow pins that exact reviewed release, source commit and current faculty digest. It can verify the existing image without building or publishing another. A same-digest first run will briefly recreate the app only if it needs bounded local Docker logs. Confirm HTTPS health, auth capabilities, the running digest, log options and the live site after the approval window.
5. For future releases, use the existing explicit public-distribution GHCR workflow on main. The existing CI, Trivy and synthetic smoke stay in place. A second isolated smoke tests faculty startup with representative existing accounts. The workflow records the verified immutable digest in a run-attempt artifact. Dispatch CD with that successful release run ID. The deploy verifier checks exact repository, workflow, attempt, main ancestry, successful gates, artifact, anonymous manifest hash, and registry config revision before obtaining AWS credentials. Release artifacts expire after 30 days.

## Rollback and basic monitoring

The GitHub concurrency group and host flock serialize deployments. The candidate first checks faculty settings and the live Atlas identities and required indexes without starting the application server. The only trusted initial predecessor is the pinned faculty baseline. Later predecessors must match the recorded verified image and be healthy and cached. After the app-only cutover, the script verifies the exact digest, bounded Docker logs, loopback and HTTPS liveness and readiness, and email-flow capability. Failure restores the previous verified image and still fails the job. The original synthetic digest is ineligible. After a disconnected session, verify the actual running digest, the override, last-verified-image and previous-image before retrying. A manual recovery must use the same host lock and a cached, verified faculty-compatible digest. When restoring the override manually, update last-verified-image only after recovery checks pass.

Use an authorized Session Manager console session and share only sanitized log excerpts.

~~~sh
cd /opt/campusswap
sudo docker compose ps
sudo docker compose logs --tail 100 app
sudo tail -n 50 /var/log/nginx/access.log /var/log/nginx/error.log
curl --fail http://127.0.0.1:8080/live
curl --fail http://127.0.0.1:8080/health
sudo docker stats --no-stream
df -h /
free -h
sudo systemctl list-timers snap.certbot.renew.timer
sudo /snap/bin/certbot certificates
~~~

When recreating app manually, use both Compose files if compose.release.yml exists, with --no-deps and --pull never. Preserve Nginx and certificate renewal. The app uses Docker's local log driver with a 10 MiB cap per file and three files. No paid monitoring or new compute is required; existing host, disk and IPv4 usage continue against the Free Plan.

## Teardown by December 18, 2026

Disable deployment by removing environment approval/access and disabling the deployment role. Review separate destroy plans for the CD and original host states. Check other consumers before removing a CD-managed OIDC provider. The host plan should target only the existing demo instance and its owned disk, instance profile, role, attachment and security group. Existing unrelated AWS infrastructure and Atlas data require separate decisions. Approve each exact destroy plan before applying it. Keep Terraform state, plans, local variables, encrypted handoffs and runtime files outside Git.
