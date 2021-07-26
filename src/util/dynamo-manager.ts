/**
 * Dynamo db managment tool
 * @module util/dynamo-manager
 * @see DynamoManager
 */

import {
  DynamoDBClient, ListTablesCommand, CreateTableCommand, ListTablesCommandOutput,
} from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient, GetCommand, GetCommandInput, GetCommandOutput, PutCommand, UpdateCommand, UpdateCommandInput,
  DeleteCommand, DeleteCommandInput, QueryCommandInput, QueryCommandOutput, QueryCommand
} from '@aws-sdk/lib-dynamodb'
import config from 'config'
import intel from 'intel'
import fs from 'fs'

const log = intel.getLogger(`REST.UTIL.DYNAMO`)

/**
 * @interface DynamoCreds describes dynamo db credentials
 */
interface DynamoCreds {
  accessKeyId: string,
  secretAccessKey: string
}

/**
 * @class DynamoManager implements dynamo db managment tool
 * @alias DynamoManager
 */
class DynamoManager {
  /** Dynamo DB client ref */
  public client_: DynamoDBClient | null = null
  /** Dynamo document client ref */
  public docClient_: DynamoDBDocumentClient | null = null
  /** Db tables list */
  public tables_: string[] = []

  /**
   * Initialize dynamo db connection
   * @returns empty promise
   */
  public async init() : Promise<void> {
    const credsPath: string = config.get('dynamo_creds_path')
    if (!credsPath) {
      throw new Error('AWS credentials path not defined')
    }

    try {
      const data: Buffer = await fs.promises.readFile(credsPath)
      const creds: DynamoCreds = JSON.parse(data.toString())

      this.client_ = new DynamoDBClient({ region: 'us-east-2', credentials: creds })
      const res: ListTablesCommandOutput = await this.client_.send(new ListTablesCommand({}))

      this.tables_ = res.TableNames || []
      log.debug(`Tables list: ${JSON.stringify(this.tables_, null, 2)}`)

      this.docClient_ = DynamoDBDocumentClient.from(this.client_)
    } catch (err: any) {
      throw new Error(`Error initializing dynamodb: ${err.message}`)
    }
  }

  /**
   * Create type table in db if not exists
   * @param name - type name which will be used as table name
   * @param description - db type representation description
   */
  public async registerModel(name: string, description: any) : Promise<void> {
    if (!this.client_) { throw new Error('Dynamo client was not initialized') }

    if (!this.tables_.includes(name)) {
      await this.client_.send(new CreateTableCommand(description))
    }
  }

  /**
   * Read model from db
   * @param name - model table name
   * @param idKey - model id key
   * @param id - model id
   * @returns model raw data or null
   */
  public async getModel(name: string, idKey: string, id: string, sortKey: string | undefined = undefined, sortVal: string | undefined = undefined) : Promise<any | undefined> {
    if (!this.docClient_) { throw new Error('Dynamo client was not initialized') }

    const input: GetCommandInput = {
      TableName: name,
      Key: undefined
    }
    input.Key = {}
    input.Key[idKey] = id
    if (sortKey) {
      input.Key[sortKey] = sortVal
    }

    const res: GetCommandOutput = await this.docClient_.send(new GetCommand(input))

    return res.Item
  }

  public async queryModels(name: string, idKey: string, id: string) : Promise<any[]> {
    if (!this.docClient_) { throw new Error('Dynamo client was not initialized') }

    const input: QueryCommandInput = {
      TableName: name,
      KeyConditionExpression: '#id = :id',
      ExpressionAttributeNames: {
        '#id': idKey
      },
      ExpressionAttributeValues: {
        ":id": id
      }
    }

    const res: QueryCommandOutput = await this.docClient_.send(new QueryCommand(input))

    return res.Items || []
  }

  /**
   * Create new model record in db
   * @param name    - model db table name
   * @param data    - model raw data
   * @param idKey   - partition key
   * @param sortKey - sort key
   * @returns false if model already exists
   */
  public async createModel(name: string, data: { [key: string]: any }, idKey: string, sortKey: string | undefined = undefined) : Promise<boolean> {
    if (!this.docClient_) { throw new Error('Dynamo client was not initialized') }

    const exprNames: any = {}
    exprNames[`#${idKey}`] = idKey
    if (sortKey) { exprNames[`#${sortKey}`] = sortKey }

    try {
      await this.docClient_.send(new PutCommand({
        TableName: name,
        Item: data,
        ConditionExpression: sortKey ? `attribute_not_exists(#${idKey}) AND attribute_not_exists(#${sortKey})` : `attribute_not_exists(#${idKey})`,
        ExpressionAttributeNames: exprNames
      }))
    } catch (err: any) {
      if (err.name === 'ConditionalCheckFailedException') {
        return false
      }

      throw err
    }

    return true
  }

  public async updateModel(name: string, data: { [key: string]: any }, idKey: string, sortKey: string | undefined = undefined) : Promise<void> {
    if (!this.docClient_) { throw new Error('Dynamo client was not intitialized') }

    // Prepare update expression
    const update: { [key: string]: any } = {}
    const attrs : { [key: string]: any } = {}
    for (const key in data) {
      update[`:${key}`] = data[key]
      attrs[`#${key}`] = key
    }
    delete update[`:${idKey}`]
    delete attrs[`#${idKey}`]
    if (sortKey) {
      delete update[`:${sortKey}`]
      delete attrs[`#${sortKey}`]
    }

    const input: UpdateCommandInput = {
      TableName: name,
      Key: undefined,
      UpdateExpression: Object.keys(update).reduce((acc: string, key: string, idx: number) => `${acc}${idx ? ',' : ''} #${key.substr(1)} = ${key}`, 'set'),
      ExpressionAttributeNames: attrs,
      ExpressionAttributeValues: update
    }
    input.Key = {}
    input.Key[idKey] = data[idKey]
    if (sortKey) { input.Key[sortKey] = data[sortKey] }

    await this.docClient_.send(new UpdateCommand(input))
  }

  public async deleteModel(name: string, idKey: string, id: string, sortKey: string | undefined = undefined, sortVal: string | undefined = undefined) : Promise<void> {
    if (!this.docClient_) { throw new Error('Dynamo client was not initialized') }

    const input: DeleteCommandInput = {
      TableName: name,
      Key: undefined
    }
    input.Key = {}
    input.Key[idKey] = id
    if (sortKey) {
      input.Key[sortKey] = sortVal
    }

    await this.docClient_.send(new DeleteCommand(input))
  }
}

const manager = new DynamoManager()
export default manager