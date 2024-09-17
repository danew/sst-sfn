import { ComponentResource, ComponentResourceOptions, jsonStringify, interpolate } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { Chainable } from "./state";
import { Transform, physicalName, transform } from "./sst-helpers";

export interface StateMachineArgs extends Partial<Omit<aws.sfn.StateMachineArgs, "definition">> {
  definition: Chainable;
  transform?: {
    stateMachine?: Transform<aws.sfn.StateMachineArgs>;
  };
}

const region = aws.config.requireRegion();

export class StateMachine extends ComponentResource {
  static __pulumiType: string;
  public readonly stateMachine: aws.sfn.StateMachine;
  public readonly role: aws.iam.Role;
  
  constructor(name: string, args: StateMachineArgs, opts?: ComponentResourceOptions) {
    super(__pulumiType, name, args, opts);

    // Create IAM role for the state machine
    this.role = args.roleArn
      ? aws.iam.Role.get(
          `${$app.name}-${$app.stage}-${name}SfnRole`,
          args.roleArn
        )
      : new aws.iam.Role(`${name}SfnRole`, {
          name: `${$app.name}-${$app.stage}-${name}`,
          assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
            Service: `states.${region}.amazonaws.com`,
          }),
        }, { parent: this });

    if (args.loggingConfiguration) {
      new aws.iam.RolePolicy(`${name}BaseExecutionPolicy`, {
        role: this.role.id,
        policy: {
          Version: "2012-10-17",
          Statement: [{
            Effect: "Allow",
            Action: [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
              "logs:CreateLogDelivery",
              "logs:GetLogDelivery",
              "logs:UpdateLogDelivery",
              "logs:DeleteLogDelivery",
              "logs:ListLogDeliveries",
              "logs:PutResourcePolicy",
              "logs:DescribeResourcePolicies",
              "logs:DescribeLogGroups",
            ],
            Resource: "*",
          }],
        },
      }, { parent: this });
    }

    new aws.iam.RolePolicy(`${name}EventPolicy`, {
      role: this.role.id,
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["events:*"],
            Resource: "*",
          },
        ],
      },
    }, { parent: this });

    args.definition.createPermissions(this.role, name);

    this.stateMachine = new aws.sfn.StateMachine(
      ...transform(
        args.transform?.stateMachine,
        `${name}StateMachine`,
        {
          name: physicalName(256, name),
          definition: jsonStringify(args.definition.serializeToDefinition()),
          roleArn: this.role.arn,
        },
        { parent: this }
      )
    );

    this.registerOutputs({
        stateMachine: this.stateMachine,
        role: this.role,
    });
  }

  /**
   * The State Machine ID.
   */
  public get id() {
    return this.stateMachine.id;
  }

  /**
   * The State Machine ARN.
   */
  public get arn() {
    return this.stateMachine.arn;
  }

  /** @internal */
  public getSSTLink() {
    return {
      properties: {
        id: this.stateMachine.id,
        arn: this.stateMachine.arn,
        roleArn: this.role.arn
      },
      include: [
        {
          type: "aws.permission",
          actions: ["states:*"],
          resources: [
            this.stateMachine.arn,
            interpolate`${this.stateMachine.arn.apply((arn) =>
              arn.replace("stateMachine", "execution")
            )}:*`,
          ],
        },
      ],
    };
  }
}

const __pulumiType = "sst:aws:StateMachine";
StateMachine.__pulumiType = __pulumiType;