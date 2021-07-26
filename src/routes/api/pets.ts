import { Request, Router, Response } from 'express'
import intel from 'intel'
import { PetParams, PetModel } from '../../models/pet'
import { UserModel } from '../../models/user'
import RequestError from '../../util/request-error'

const router: Router = Router()

// Get pets for authenticated user
router.get('/', (req: Request, res: Response) => {
  const log = intel.getLogger('REST.API.PETS.SEARCH')
  const user: UserModel = <UserModel>req.user

  PetModel.search(user.email)
    .then((pets: PetModel[]) => {
      res.status(200).json(pets.map(pet => pet.json()))
    })
    .catch((err: any) => {
      log.error(`Error searching for user ${user.email} pets: ${err.message}`)
      res.status(err.status || 500).json({ success: false, message: err.message })
    })
})

router.get('/:name', (req: Request, res: Response) => {
  const log = intel.getLogger('REST.API.PETS.GET')
  const user: UserModel = <UserModel>req.user

  PetModel.findById(user.email, req.params.name)
    .then((pet: PetModel | null) => {
      if (!pet) { throw new RequestError(404, `Pet ${req.params.name} does not exist`) }
      res.status(200).json(pet.json())
    })
    .catch((err: any) => {
      log.error(`Error getting pet ${req.params.name}: ${err.message}`)
      res.status(err.status || 500).json({ success: false, message: err.message })
    })
})

router.post('/', (req: Request, res: Response) => {
  const log = intel.getLogger('REST.API.PETS.POST')
  const params: PetParams = req.body
  const user: UserModel = <UserModel>req.user

  const pet = new PetModel({ ...params, user: user.email })
  if (!pet.isValid()) {
    res.status(400).json({ success: false, message: 'Bad parameters' })
    return
  }

  pet.create()
    .then(() => res.status(201).json(pet.json()))
    .catch((err: any) => {
      log.error(`Error creating new pet: ${err.message}`)
      res.status(err.status || 500).json({ success: false, message: err.message })
    })
})

router.patch('/:name', (req: Request, res: Response) => {
  const log = intel.getLogger('REST.API.PETS.PATCH')
  const user: UserModel = <UserModel>req.user

  let pet: PetModel
  PetModel.findById(user.email, req.params.name)
    .then((found: PetModel | null) => {
      if (!found) { throw new RequestError(404, `Pet ${req.params.name} does not exist`) }
      pet = found
      return pet.update(req.body)
    })
    .then(() => res.status(200).json(pet.json()))
    .catch((err: any) => {
      log.error(`Error updating pet ${req.params.name}: ${err.message}`)
      res.status(err.status || 500).json({ success: false, message: err.message })
    })
})

router.delete('/:name', (req: Request, res: Response) => {
  const log = intel.getLogger('REST.API.PETS.DELETE')
  const user: UserModel = <UserModel>req.user

  PetModel.findById(user.email, req.params.name)
    .then(pet => {
      if (!pet) { throw new RequestError(404, `Pet ${req.params.name} does not exist`) }
      return pet.delete()
    })
    .then(() => res.status(200).json({ success: true, message: 'OK' }))
    .catch(err => {
      log.error(`Error deleting pet ${req.params.name}: ${err.message}`)
      res.status(err.status || 500).json({ success: false, message: err.message })
    })
})

export default router