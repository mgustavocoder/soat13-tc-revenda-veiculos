import { VeiculoUsecase } from '../../application/usecases/veiculo-usecase.js'
import { MysqlVeiculoRepository } from '../datasource/mysql-veiculo-repository.js'
import { VeiculoController } from './veiculo-controller.js'

const controllersFactory = ({ db }) => {
  const veiculoRepository = new MysqlVeiculoRepository(db)
  const veiculoUsecase = new VeiculoUsecase(veiculoRepository)
  return { veiculoController: new VeiculoController(veiculoUsecase) }
}

export { controllersFactory }
