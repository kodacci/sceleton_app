import { BasicModelImpl, BasicModelParams } from './basic-model-impl'
import dynamoManager from '../util/dynamo-manager'

interface PetParams extends BasicModelParams {
  animal: string,
  name: string,
  age: number
}

class PetModel extends BasicModelImpl {
  /** Db table name */
  public static readonly DB_NAME: string = 'Pets'
  /** Db table description */
  public static readonly DB_DESCRIPTION: any = {
    TableName: PetModel.DB_NAME,
    AttributeDefinitions: [
      {
        AttributeName: 'user',
        AttributeType: 'S'
      }, {
        AttributeName: 'name',
        AttributeType: 'S'
      }
    ],
    KeySchema: [
      {
        AttributeName: 'user',
        KeyType: 'HASH'
      }, {
        AttributeName: 'name',
        KeyType: 'RANGE'
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 2
    }
  }

  /** Db table name for accessing in model instances methods */
  public readonly DB_NAME: string = PetModel.DB_NAME
  /** Props that can be update */
  protected readonly UPDATE_PROPS: string[] = ['animal', 'age']
  /** Props description to validate */
  protected readonly PROPS_DCS: { name: string, type: 'string'|'number' }[] = [
    { name: 'name', type: 'string' },
    { name: 'animal', type: 'string' },
    { name: 'age', type: 'number' }
  ]
  protected readonly SORT_KEY: string = 'name'

  /**
   * Find model in db by id
   * @param partition - partition key
   * @param sort      - sort key
   * @returns promise with model instance or null
   */
  public static async findById(partition: string, sort: string | undefined) : Promise<PetModel | null> {
    const data: PetParams | null = await dynamoManager.getModel(this.DB_NAME, 'user', partition, 'name', sort)

    if (!data) { return null }

    return new this(data)
  }

  /**
   * Search for pets by user id
   * @param partition - partition key
   * @returns promise with found pets models
   */
  public static async search(partition: string) : Promise<PetModel[]> {
    const pets: PetParams[] = await dynamoManager.queryModels(this.DB_NAME, 'user', partition)

    return pets.map(pet => new this(pet))
  }

  /**
   * Create new instance of PetModel
   * @param data_ - pet raw params
   */
  constructor(data_: PetParams) {
    super(data_)
  }

  /**
   * Validate pet data
   * @returns true if data is valid
   */
  public isValid() : boolean {
    return super.isValid() && !!(<PetParams>this.data_).name.length
  }
}

export { PetModel, PetParams }