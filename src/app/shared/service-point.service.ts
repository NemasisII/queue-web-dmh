import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ServicePointService {

  constructor(@Inject('API_URL') private apiUrl: string, private httpClient: HttpClient) { }

  async list() {
    const _url = `${this.apiUrl}/service-point`;
    return this.httpClient.get(_url).toPromise();
  }

  async save(data: object) {
    const _url = `${this.apiUrl}/service-point`;
    return this.httpClient.post(_url, data).toPromise();
  }

  async update(servicePointId: any, data: object) {
    const _url = `${this.apiUrl}/service-point/${servicePointId}`;
    return this.httpClient.put(_url, data).toPromise();
  }

  async remove(servicePointId: any) {
    const _url = `${this.apiUrl}/service-point/${servicePointId}`;
    return this.httpClient.delete(_url).toPromise();
  }

}